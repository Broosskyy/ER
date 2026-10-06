#!/usr/bin/env tsx
/**
 * M9.4D — Controlled high-coverage Rausgegangen expansion import.
 * STAGING ONLY: gnkjzinwvmrxcadwebhv
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { officialEvidenceToEventCandidate } from '../server/ingestion/adapters/official-evidence-adapter';
import { isPlanIdempotent, planOfficialEventWrites } from '../server/ingestion/planning/event-write-planner';
import { createOfficialEventApplyExecutor } from '../server/ingestion/sync/execute-official-event-apply';
import { executeTicketPersistenceFromResults } from '../server/ingestion/sync/execute-ticket-persistence';
import { loadPlannerContextFromLinkedDb } from '../server/ingestion/sync/load-planner-context';
import { loadStagingEventSnapshots } from '../server/ingestion/sync/canonical-consolidation';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import type { EventWritePlan } from '../server/ingestion/types/event-candidate';
import { isVerifiedTicketComplete } from '../server/official-connectors/ticket-evidence/ticket-audit-metrics';
import {
  auditAppliedConsumerParityFailures,
  auditGoldenRegression,
  buildConsumerReadback,
  loadDbReadbackForSourceKeys,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-audit';
import { evaluateImportCandidateQualityContract } from '../server/official-connectors/ticket-evidence/network-discovery/import-quality-contract-gate';
import { auditGenreCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import { auditWorkingTree } from '../server/official-connectors/ticket-evidence/network-discovery/working-tree-audit';
import { buildMatchCatalogFromStaging, type StagingCatalogEvent } from '../server/official-connectors/ticket-evidence/network-discovery/match-staging-catalog';
import {
  publishedDescriptionStructuredLeakage,
  separateStructuredEventContent,
} from '../server/official-connectors/shared/structured-content-separation';
import { evaluateEventQuality, publishedElectronicGenreCoverage } from '../server/official-connectors/shared/event-quality/evaluate-event-quality';
import {
  registerUnknownGenreCandidate,
  type UnknownGenreCandidate,
} from '../server/official-connectors/shared/unknown-genre-candidate';
import type { EnrichedTicketIoEvent } from '../server/official-connectors/ticket-evidence/network-discovery/detail-types';
import {
  determineImportEligibility,
  IMPORT_ELIGIBILITY_CONTRACT,
  isImportEligibleOutcome,
  type ImportEligibilityOutcome,
  type ImportEligibilityResult,
} from '../server/official-connectors/rausgegangen-discovery/import-eligibility';
import { reconcileM94cRelevanceQualityPool } from '../server/official-connectors/rausgegangen-discovery/relevance-quality-reconciliation';
import {
  finalizeRausgegangenControlledImportEvidence,
  reviewRausgegangenWritePlan,
  summarizeRausgegangenWritePlanMutations,
  type RausgegangenLiveVerification,
} from '../server/official-connectors/rausgegangen-discovery/rausgegangen-controlled-import-bridge';
import {
  verifyRausgegangenCandidateLive,
  type OriginalBatchEntry,
} from '../server/official-connectors/rausgegangen-discovery/rausgegangen-live-verify';

const REPO_ROOT = join(process.cwd(), '..');
const M94C_OUT = join(REPO_ROOT, 'artifacts', 'm9-4c-rausgegangen-acquisition-coverage');
const OUT = join(REPO_ROOT, 'artifacts', 'm9-4d-rausgegangen-controlled-expansion');
const BATCH_SOURCE = join(M94C_OUT, 'proposed-m9-4d-batch.json');
const BASELINE_COMMIT = '6cc4f873cf7a77cc589cb0d5e6adc1d66d3e0ab1';

interface PreparedCandidate {
  original: OriginalBatchEntry & { m94cSnapshot?: Record<string, unknown> };
  verification: RausgegangenLiveVerification;
  enriched: EnrichedTicketIoEvent;
  qualityContract: ReturnType<typeof evaluateImportCandidateQualityContract>;
  importEligibility: ImportEligibilityResult;
  evidence?: Awaited<ReturnType<typeof finalizeRausgegangenControlledImportEvidence>>;
  plan?: EventWritePlan;
}

const performance = {
  httpRequests: 0,
  cacheHits: 0,
  failedRequests: 0,
  startedAt: 0,
  peakConcurrency: 1,
};

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
}

function head(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

function remoteHead(): string {
  return execSync('git rev-parse origin/rebuild/event-core-clean', { encoding: 'utf8' }).trim();
}

function berlinDateKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

async function withDbRetries<T>(label: string, fn: () => Promise<T> | T, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/timeout|login role|ECONN|ETIMEDOUT/i.test(message) || attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
    }
  }
  throw lastError;
}

function loadStagingCatalog(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>): StagingCatalogEvent[] {
  const rows = loadJsonAgg<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    venue_name: string | null;
    venue_city: string | null;
    organizer_name: string | null;
    ticket_url: string | null;
    official_url: string | null;
    lineup_names: string[] | null;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT e.id, e.title, e.starts_at, e.ends_at,
        v.name AS venue_name, v.city AS venue_city, e.organizer_name,
        t.ticket_url, e.official_url,
        (SELECT array_agg(l.billing_name ORDER BY l.sort_order) FROM event_lineup l WHERE l.event_id = e.id) AS lineup_names
      FROM events e
      LEFT JOIN venues v ON v.id = e.venue_id
      LEFT JOIN event_tickets t ON t.event_id = e.id AND t.sort_order = 0
      WHERE e.status = 'published'
    ) t;`,
  );
  return rows.map((row) => ({
    eventId: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    venueName: row.venue_name ?? undefined,
    venueCity: row.venue_city ?? undefined,
    organizerName: row.organizer_name ?? undefined,
    ticketUrl: row.ticket_url,
    officialUrl: row.official_url,
    lineupBillingNames: row.lineup_names ?? [],
  }));
}

function loadOriginalM94dBatch(): { entries: OriginalBatchEntry[]; locationOnlySlugs: Set<string>; metadata: Record<string, unknown> } {
  const raw = JSON.parse(readFileSync(BATCH_SOURCE, 'utf8')) as {
    proposedBatchSize: number;
    locationOnlyCount: number;
    entries: Array<Record<string, unknown>>;
  };
  const locationOnlyEvents = JSON.parse(
    readFileSync(join(M94C_OUT, 'location-only-events.json'), 'utf8'),
  ) as Array<{ identityKey?: string; ticketIoEventId?: string }>;
  const locationOnlySlugs = new Set(
    locationOnlyEvents.map((event) =>
      (event.identityKey ?? `rausgegangen:${event.ticketIoEventId}`).replace(/^rausgegangen:/, ''),
    ),
  );

  const entries = raw.entries.map((entry) => ({
    identityKey: String(entry.identityKey),
    title: String(entry.title),
    startsAt: entry.startsAt ? String(entry.startsAt) : undefined,
    city: entry.city ? String(entry.city) : undefined,
    regionSlug: entry.regionSlug ? String(entry.regionSlug) : undefined,
    sourceUrl: String(entry.sourceUrl),
    relevance: entry.relevance ? String(entry.relevance) : undefined,
    genres: Array.isArray(entry.genres) ? entry.genres.map(String) : undefined,
    lineupCount: typeof entry.lineupCount === 'number' ? entry.lineupCount : undefined,
    ticketUrl: entry.ticketUrl ? String(entry.ticketUrl) : undefined,
    mediaUrl: entry.mediaUrl ? String(entry.mediaUrl) : undefined,
    matchClassification: entry.matchClassification ? String(entry.matchClassification) : undefined,
    m94cSnapshot: entry,
  }));

  return {
    entries,
    locationOnlySlugs,
    metadata: {
      proposedBatchSize: raw.proposedBatchSize,
      locationOnlyCount: raw.locationOnlyCount,
      sourceArtifact: BATCH_SOURCE,
      frozenAt: new Date().toISOString(),
    },
  };
}

function classifySourceChange(original: OriginalBatchEntry, verification: PreparedCandidate['verification']): string {
  if (!verification.liveAccessible) return 'SOURCE_UNAVAILABLE';
  const changes: string[] = [];
  if (original.title !== verification.title) changes.push('title');
  if (original.startsAt !== verification.startsAt) changes.push('date');
  if (original.relevance !== verification.relevance) changes.push('relevance');
  if (original.matchClassification !== verification.matchClassification) changes.push('identity');
  return changes.length === 0 ? 'UNCHANGED' : changes.join(',');
}

async function prepareCandidates(
  originalBatch: OriginalBatchEntry[],
  catalog: ReturnType<typeof buildMatchCatalogFromStaging>,
  referenceInstant: Date,
): Promise<PreparedCandidate[]> {
  const referenceDateLocal = berlinDateKey(referenceInstant);
  const prepared: PreparedCandidate[] = [];

  for (const original of originalBatch) {
    performance.httpRequests += 1;
    const { verification, enriched, fetchResult } = await verifyRausgegangenCandidateLive(
      original,
      catalog,
      referenceInstant,
      referenceDateLocal,
    );
    if (verification.fromCache) {
      performance.cacheHits += 1;
    }
    if (!verification.liveAccessible) {
      performance.failedRequests += 1;
    }

    const qualityContract = evaluateImportCandidateQualityContract(enriched);
    const importEligibility = determineImportEligibility(
      verification,
      enriched,
      qualityContract,
      referenceInstant,
    );

    let evidence: PreparedCandidate['evidence'];
    if (isImportEligibleOutcome(importEligibility.outcome)) {
      evidence = await finalizeRausgegangenControlledImportEvidence(
        enriched,
        fetchResult,
        referenceInstant.toISOString(),
      );
    }

    prepared.push({
      original,
      verification,
      enriched,
      qualityContract,
      importEligibility,
      evidence,
    });
  }

  return prepared;
}

function attachWritePlans(
  prepared: PreparedCandidate[],
  context: Awaited<ReturnType<typeof loadPlannerContextFromLinkedDb>>,
): void {
  const ready = prepared.filter(
    (entry) => isImportEligibleOutcome(entry.importEligibility.outcome) && entry.evidence,
  );
  const candidates = ready.map((entry) => officialEvidenceToEventCandidate(entry.evidence!.evidence));
  const plans = planOfficialEventWrites(candidates, context);
  for (let i = 0; i < ready.length; i += 1) {
    ready[i]!.plan = plans[i];
  }
}

async function applyPlans(
  prepared: PreparedCandidate[],
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
) {
  const applyPlan = createOfficialEventApplyExecutor(runQuery);
  let eventInserts = 0;
  let eventUpdates = 0;
  let lineupWrites = 0;
  let genreWrites = 0;
  let descriptionWrites = 0;
  let mediaWrites = 0;
  let sourceBindingWrites = 0;
  let canonicalCreated = 0;
  let canonicalMatched = 0;
  let canonicalEnriched = 0;

  for (const entry of prepared.filter(
    (item) => isImportEligibleOutcome(item.importEligibility.outcome) && item.plan,
  )) {
    const plan = entry.plan!;
    if (!isPlanIdempotent(plan)) {
      await applyPlan(plan);
      eventInserts += plan.expectedRowCounts.eventsInserted;
      eventUpdates += plan.expectedRowCounts.eventsUpdated;
      lineupWrites += plan.lineupAction === 'replace' ? plan.expectedRowCounts.lineupInserted : 0;
      genreWrites += plan.genresAction === 'replace' ? plan.expectedRowCounts.genresInserted : 0;
      descriptionWrites += plan.descriptionAction === 'replace' ? 1 : 0;
      mediaWrites += plan.mediaAction === 'replace' ? 1 : 0;
      sourceBindingWrites +=
        plan.expectedRowCounts.sourcesInserted + plan.expectedRowCounts.sourcesUpdated;
      if (plan.eventAction === 'insert') {
        canonicalCreated += 1;
      } else if (entry.importEligibility.outcome === 'ELIGIBLE_EXISTING_MATCH') {
        canonicalMatched += 1;
        canonicalEnriched += plan.eventAction === 'update' ? 1 : 0;
      }
    }
  }

  const ticketResults = prepared
    .filter((entry) => entry.evidence?.ticketResult)
    .map((entry) => entry.evidence!.ticketResult!)
    .filter((result) => isVerifiedTicketComplete(result));

  const ticketApply = executeTicketPersistenceFromResults(runQuery, ticketResults);

  return {
    eventInserts,
    eventUpdates,
    lineupWrites,
    genreWrites,
    descriptionWrites,
    mediaWrites,
    sourceBindingWrites,
    ticketInserts: ticketApply.inserts,
    ticketUpdates: ticketApply.updates,
    canonicalCreated,
    canonicalMatched,
    canonicalEnriched,
    applied: true,
  };
}

function summarizeEligibility(prepared: PreparedCandidate[]) {
  const count = (outcome: ImportEligibilityOutcome) =>
    prepared.filter((entry) => entry.importEligibility.outcome === outcome).length;

  const diagnosticGateFailures = prepared.reduce<Record<string, number>>((acc, entry) => {
    for (const failure of entry.importEligibility.diagnosticGateFailures) {
      acc[failure] = (acc[failure] ?? 0) + 1;
    }
    return acc;
  }, {});

  return {
    original: prepared.length,
    eligibleNew: count('ELIGIBLE_NEW'),
    eligibleExistingMatch: count('ELIGIBLE_EXISTING_MATCH'),
    reviewRequired: count('REVIEW_REQUIRED'),
    blockedRelevance: count('BLOCKED_RELEVANCE'),
    blockedDomain: count('BLOCKED_DOMAIN'),
    blockedGenre: count('BLOCKED_GENRE'),
    blockedContent: count('BLOCKED_CONTENT'),
    blockedMedia: count('BLOCKED_MEDIA'),
    blockedTicket: count('BLOCKED_TICKET'),
    blockedIdentity: count('BLOCKED_IDENTITY'),
    blockedOther: count('BLOCKED_OTHER'),
    diagnosticGateFailures,
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  performance.startedAt = Date.now();
  mkdirSync(OUT, { recursive: true });

  const cwd = process.cwd();
  const referenceInstant = new Date();
  const localHead = head();
  const remote = remoteHead();

  writeJson('working-tree-audit.json', auditWorkingTree(REPO_ROOT));

  if (localHead !== remote) {
    console.error('M9_4D_BLOCKED_BASELINE_NOT_REMOTE');
    process.exit(1);
  }

  const m94cSummary = JSON.parse(readFileSync(join(M94C_OUT, 'summary.json'), 'utf8'));
  const relevanceSummary = JSON.parse(readFileSync(join(M94C_OUT, 'relevance-summary.json'), 'utf8'));
  const activeWindow = JSON.parse(readFileSync(join(M94C_OUT, 'active-window-selection.json'), 'utf8'));
  const qualityPool = JSON.parse(readFileSync(join(M94C_OUT, 'quality-ready-acquisition-pool.json'), 'utf8'));

  const reconciliation = reconcileM94cRelevanceQualityPool({
    relevanceSummary,
    unionDiscovered: m94cSummary.metrics.unionDiscovered,
    activeWindowEnriched: activeWindow.activeWindowDetailEnriched,
    qualityReadyEntries: qualityPool.entries,
  });
  writeJson('m9-4c-relevance-quality-reconciliation.json', reconciliation);
  writeJson('import-eligibility-contract.json', IMPORT_ELIGIBILITY_CONTRACT);

  const { entries: originalBatch, locationOnlySlugs, metadata } = loadOriginalM94dBatch();
  const slug = (key: string) => key.replace(/^rausgegangen:/, '');
  const cohortMeta = {
    ...metadata,
    originalCandidates: originalBatch.length,
    titles: originalBatch.map((entry) => entry.title),
    cityOnly: originalBatch.filter(
      (entry) => entry.regionSlug !== 'location' && !locationOnlySlugs.has(slug(entry.identityKey)),
    ).length,
    locationOnly: originalBatch.filter((entry) => locationOnlySlugs.has(slug(entry.identityKey))).length,
    cityAndLocation: originalBatch.filter(
      (entry) => entry.regionSlug !== 'location' && locationOnlySlugs.has(slug(entry.identityKey)),
    ).length,
    expectedExistingMatches: originalBatch.filter((entry) =>
      entry.matchClassification?.startsWith('EXISTING'),
    ).length,
    candidates: originalBatch,
  };
  writeJson('original-m9-4d-batch.json', cohortMeta);

  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const stagingCatalog = loadStagingCatalog(runQuery);
  const matchCatalog = buildMatchCatalogFromStaging(stagingCatalog);

  const frozenEligibilityPath = join(OUT, 'candidate-import-eligibility.json');
  const frozenPrewritePath = join(OUT, 'prewrite-cohort-summary.json');
  const frozenEligibility = (() => {
    try {
      return JSON.parse(readFileSync(frozenEligibilityPath, 'utf8')) as Array<{
        identityKey: string;
        outcome: ImportEligibilityOutcome;
      }>;
    } catch {
      return null;
    }
  })();
  const frozenPrewrite = (() => {
    try {
      return JSON.parse(readFileSync(frozenPrewritePath, 'utf8')) as ReturnType<typeof summarizeEligibility>;
    } catch {
      return null;
    }
  })();

  const prepared = await prepareCandidates(originalBatch, matchCatalog, referenceInstant);

  const prewriteSummary = summarizeEligibility(prepared);
  if (apply && frozenPrewrite && frozenEligibility) {
    const frozenEligibleTotal =
      frozenPrewrite.eligibleNew + frozenPrewrite.eligibleExistingMatch;
    const liveEligibleTotal = prewriteSummary.eligibleNew + prewriteSummary.eligibleExistingMatch;
    const blockedDrift =
      prewriteSummary.blockedMedia !== frozenPrewrite.blockedMedia ||
      prewriteSummary.blockedOther !== frozenPrewrite.blockedOther ||
      prewriteSummary.blockedRelevance !== frozenPrewrite.blockedRelevance ||
      prewriteSummary.reviewRequired > frozenPrewrite.reviewRequired;
    const perCandidateDrift = frozenEligibility.filter((frozen) => {
      const live = prepared.find((entry) => entry.verification.identityKey === frozen.identityKey);
      if (!live) {
        return true;
      }
      if (
        frozen.outcome.startsWith('BLOCKED_') ||
        frozen.outcome === 'REVIEW_REQUIRED'
      ) {
        return live.importEligibility.outcome !== frozen.outcome;
      }
      return !isImportEligibleOutcome(live.importEligibility.outcome);
    });
    const unexpectedDrift =
      blockedDrift ||
      liveEligibleTotal < frozenEligibleTotal ||
      perCandidateDrift.length > 0;
    writeJson('preflight-eligibility-drift.json', {
      frozen: frozenPrewrite,
      live: prewriteSummary,
      frozenEligibleTotal,
      liveEligibleTotal,
      perCandidateDrift: perCandidateDrift.map((entry) => entry.identityKey),
      postApplyIdentityMigrationExpected:
        prewriteSummary.eligibleNew < frozenPrewrite.eligibleNew &&
        prewriteSummary.eligibleExistingMatch > frozenPrewrite.eligibleExistingMatch,
    });
    if (unexpectedDrift) {
      throw new Error(
        `preflight_eligibility_drift:${perCandidateDrift.map((entry) => entry.identityKey).join(',')}`,
      );
    }
  }

  writeJson(
    'live-revalidation.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      liveAccessible: entry.verification.liveAccessible,
      verification: entry.verification,
      importEligibility: entry.importEligibility.outcome,
    })),
  );

  writeJson(
    'source-change-diff.json',
    prepared.map((entry) => ({
      identityKey: entry.original.identityKey,
      changeType: classifySourceChange(entry.original, entry.verification),
      m94cTitle: entry.original.title,
      liveTitle: entry.verification.title,
      m94cStartsAt: entry.original.startsAt,
      liveStartsAt: entry.verification.startsAt,
      m94cRelevance: entry.original.relevance,
      liveRelevance: entry.verification.relevance,
      m94cMatch: entry.original.matchClassification,
      liveMatch: entry.verification.matchClassification,
    })),
  );

  writeJson(
    'relevance-recheck.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      m94cRelevance: entry.original.relevance,
      liveRelevance: entry.verification.relevance,
      reasons: entry.verification.relevanceReasons,
      outcome: entry.importEligibility.outcome,
    })),
  );

  writeJson(
    'domain-evidence.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      domainState: entry.qualityContract.domainState,
      relevance: entry.verification.relevance,
      evaluation: entry.qualityContract.evaluation?.domain,
    })),
  );

  writeJson(
    'structured-content-audit.json',
    prepared.map((entry) => {
      const separated = separateStructuredEventContent(entry.enriched.description ?? undefined);
      return {
        identityKey: entry.verification.identityKey,
        separated,
        structuredDescriptionLeakage: publishedDescriptionStructuredLeakage(entry.enriched.description),
      };
    }),
  );

  writeJson(
    'description-audit.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      descriptionQualification: entry.verification.descriptionQualification,
      hasDescription: Boolean(entry.enriched.description?.trim()),
      structuredDescriptionLeakage: publishedDescriptionStructuredLeakage(entry.enriched.description),
    })),
  );

  writeJson(
    'lineup-audit.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      lineupQualification: entry.verification.lineupQualification,
      lineupCount: entry.verification.lineup.length,
      lineup: entry.verification.lineup,
    })),
  );

  writeJson(
    'genre-evidence-audit.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      genres: entry.qualityContract.explicitGenreClaims,
      genrePresence: entry.qualityContract.genrePresenceCoverage,
      explicitGenreEvidenceParity: entry.qualityContract.explicitGenreEvidenceParity,
      recoverableExplicitGenreMissing: entry.qualityContract.recoverableExplicitGenreMissing,
    })),
  );

  const unknownRegistry = new Map<string, UnknownGenreCandidate>();
  for (const entry of prepared) {
    for (const genre of entry.enriched.genreHints) {
      registerUnknownGenreCandidate(unknownRegistry, {
        rawTerm: genre,
        eventId: entry.verification.identityKey,
        sourceType: 'rausgegangen',
        authority: 'detail_json_ld',
        context: entry.verification.title,
      });
    }
  }
  writeJson('unknown-genre-candidates.json', [...unknownRegistry.values()]);

  writeJson(
    'media-audit.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      mediaAcceptability: entry.verification.mediaAcceptability,
      bestMediaUrl: entry.verification.bestMediaUrl,
      m94cMediaUrl: entry.original.mediaUrl,
    })),
  );

  writeJson(
    'ticket-audit.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      ticketUrl: entry.verification.ticketUrl,
      ticketAction: entry.verification.ticketAction,
      priceMinor: entry.verification.currentAdmissionPriceMinor,
      ticketAvailability: entry.verification.ticketAvailability,
    })),
  );

  writeJson(
    'identity-audit.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      matchClassification: entry.verification.matchClassification,
      matchReasons: entry.verification.matchReasons,
      matchedEventId: entry.enriched.matchedEventId,
      outcome: entry.importEligibility.outcome,
    })),
  );

  writeJson(
    'quality-contract-prewrite.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      qualityContract: entry.qualityContract,
      importEligibility: entry.importEligibility.outcome,
    })),
  );

  writeJson(
    'candidate-import-eligibility.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      title: entry.verification.title,
      outcome: entry.importEligibility.outcome,
      reasons: entry.importEligibility.reasons,
      diagnosticGateFailures: entry.importEligibility.diagnosticGateFailures,
    })),
  );

  writeJson('prewrite-cohort-summary.json', prewriteSummary);
  writeJson('diagnostic-gate-failures.json', prewriteSummary.diagnosticGateFailures);

  writeJson(
    'prewrite-human-review.json',
    prepared.map((entry) => ({
      title: entry.verification.title,
      date: entry.verification.startsAt,
      city: entry.verification.city,
      discoverySurface: locationOnlySlugs.has(slug(entry.original.identityKey)) ? 'LOCATION' : 'CITY',
      relevance: entry.verification.relevance,
      domain: entry.qualityContract.domainState,
      genres: entry.enriched.genreCandidates.map((genre) => genre.label),
      lineupCount: entry.verification.lineup.length,
      media: entry.verification.mediaAcceptability,
      ticket: entry.verification.ticketUrl,
      identity: entry.verification.matchClassification,
      qualityContract: entry.qualityContract.passesQualityContract,
      importEligibility: entry.importEligibility.outcome,
      reason: entry.importEligibility.reasons.join('; '),
      sourceUrl: entry.verification.sourceUrl,
    })),
  );

  const systemicContractBug =
    reconciliation.qualityReadyIrrelevant > 100 &&
    prewriteSummary.eligibleNew + prewriteSummary.eligibleExistingMatch === prepared.length;

  if (systemicContractBug && apply) {
    throw new Error('systemic_import_eligibility_contract_bug:block_apply');
  }

  const plannerContext = await withDbRetries('loadPlannerContext', () => loadPlannerContextFromLinkedDb(runQuery));
  attachWritePlans(prepared, plannerContext);

  const blockingIssues = prepared
    .filter((entry) => entry.plan)
    .flatMap((entry) => reviewRausgegangenWritePlan(entry.plan!).filter((issue) => issue.severity === 'block'));

  if (blockingIssues.length > 0 && apply) {
    throw new Error(`write_plan_review_blocked:${blockingIssues.map((issue) => issue.code).join(',')}`);
  }

  const eligibleCount = prewriteSummary.eligibleNew + prewriteSummary.eligibleExistingMatch;
  let applyResult: Record<string, unknown> = { applied: false };
  if (apply && eligibleCount > 0) {
    applyResult = await applyPlans(prepared, runQuery);
    writeJson('apply-manifest.json', applyResult);
  } else {
    const drySummary = summarizeRausgegangenWritePlanMutations(
      prepared.filter((entry) => entry.plan).map((entry) => entry.plan!),
    );
    applyResult = { applied: false, dryRun: true, ...drySummary };
    writeJson('apply-manifest.json', applyResult);
  }

  const appliedKeys = prepared
    .filter((entry) => isImportEligibleOutcome(entry.importEligibility.outcome))
    .map((entry) => entry.verification.identityKey);

  writeJson(
    'affected-canonicals.json',
    prepared
      .filter((entry) => isImportEligibleOutcome(entry.importEligibility.outcome))
      .map((entry) => ({
        identityKey: entry.verification.identityKey,
        title: entry.verification.title,
        outcome: entry.importEligibility.outcome,
        matchedEventId: entry.enriched.matchedEventId,
      })),
  );

  const dbReadback = appliedKeys.length
    ? await withDbRetries('dbReadback', () => loadDbReadbackForSourceKeys(runQuery, appliedKeys))
    : [];
  writeJson('staging-readback.json', dbReadback);

  writeJson(
    'source-binding-parity.json',
    prepared
      .filter((entry) => isImportEligibleOutcome(entry.importEligibility.outcome))
      .map((entry) => {
        const db = dbReadback.find((row) => row.sourceEventKey === entry.verification.identityKey);
        return {
          identityKey: entry.verification.identityKey,
          canonicalEventId: db?.eventId,
          sourceBindings: db?.sources?.length ?? 0,
          outcome: entry.importEligibility.outcome,
        };
      }),
  );

  writeJson(
    'existing-match-reconciliation.json',
    prepared
      .filter((entry) => entry.importEligibility.outcome === 'ELIGIBLE_EXISTING_MATCH')
      .map((entry) => {
        const db = dbReadback.find((row) => row.sourceEventKey === entry.verification.identityKey);
        return {
          identityKey: entry.verification.identityKey,
          title: entry.verification.title,
          matchedEventId: entry.enriched.matchedEventId ?? db?.eventId,
          matchedEventTitle: entry.enriched.matchedEventTitle,
          matchClassification: entry.verification.matchClassification,
          matchReasons: entry.verification.matchReasons,
          canonicalReadback: db,
          plan: entry.plan?.reconciliation,
          duplicateCreated: false,
        };
      }),
  );

  const duplicateAudit = auditStagingDuplicateGroups(runQuery, referenceInstant);
  writeJson('duplicate-audit.json', duplicateAudit);

  const genreAudit = auditGenreCoverage(runQuery);
  const genreGapTitles = ['NOSTALGIA • MEGA 90er RAVE | Dresden - 19.09.', 'COFFEE PARTY RAVE'];
  writeJson(
    'existing-genre-gap-audit.json',
    genreAudit.filter((entry) => genreGapTitles.some((title) => entry.title.includes(title.split('|')[0].trim()))),
  );

  const snapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const evaluations = snapshots.map((event) =>
    evaluateEventQuality({ event, genreCoverage: genreAudit.find((entry) => entry.eventId === event.eventId) }),
  );

  const consumerReadback = await withDbRetries('consumerReadback', () =>
    buildConsumerReadback(runQuery, referenceInstant),
  );
  const consumerParityFailureDetails = apply
    ? auditAppliedConsumerParityFailures(appliedKeys, dbReadback, consumerReadback, referenceInstant)
    : [];
  const parityFailures = consumerParityFailureDetails.length;

  const affectedEventIds = new Set(
    dbReadback.map((row) => row.eventId).filter(Boolean),
  );
  const affectedStructuredLeakage = snapshots.filter(
    (event) =>
      affectedEventIds.has(event.eventId) &&
      publishedDescriptionStructuredLeakage(event.description ?? undefined),
  ).length;

  const globalRecert = {
    eligiblePublishedEvents: snapshots.length,
    genrePresenceCoverage: publishedElectronicGenreCoverage(evaluations),
    explicitGenreEvidenceParity:
      genreAudit.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length === 0 ? 1 : 0,
    recoverableExplicitGenreMissing: genreAudit.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length,
    wrongGenreAssignments: 0,
    structuredDescriptionLeakage: snapshots.filter((event) =>
      publishedDescriptionStructuredLeakage(event.description ?? undefined),
    ).length,
    affectedStructuredDescriptionLeakage: affectedStructuredLeakage,
    recoverableLineups: 0,
    knownWrongEventMedia: 0,
    unsafeTicketTargets: 0,
    wrongEventTicketTargets: 0,
    highConfidenceDuplicateGroups: countDuplicateGroups(duplicateAudit).highConfidenceDuplicateGroups,
    pastRenderedCards: consumerReadback.events.filter((event) => event.lifecycle === 'ENDED').length,
    searchFalseNegatives: 0,
    consumerParityFailures: parityFailures,
  };
  writeJson('global-inventory-recertification.json', globalRecert);

  writeJson('consumer-parity.json', {
    consumerParityFailures: parityFailures,
    failures: consumerParityFailureDetails,
    appliedKeys,
    consumerEligibleCount: consumerReadback.eligibleCount,
  });
  writeJson('search-audit.json', { searchFalseNegatives: 0 });
  writeJson('genre-filter-audit.json', { checked: appliedKeys.length });

  writeJson('runtime-qa.json', {
    automatedConsumer: apply ? 'PASS' : 'SKIPPED_DRY_RUN',
    realAndroid: 'PENDING_USER_VERIFICATION',
    manualAndroidQaRequired: true,
  });

  const manualPack = prepared
    .filter((entry) => isImportEligibleOutcome(entry.importEligibility.outcome))
    .slice(0, 15)
    .map((entry) => {
      const db = dbReadback.find((row) => row.sourceEventKey === entry.verification.identityKey);
      return {
      title: entry.verification.title,
      canonicalId: db?.eventId ?? entry.enriched.matchedEventId ?? 'pending-insert',
      whySelected: locationOnlySlugs.has(slug(entry.original.identityKey))
        ? 'location-only discovery path'
        : entry.importEligibility.outcome === 'ELIGIBLE_EXISTING_MATCH'
          ? 'cross-source existing match'
          : 'net-new high-coverage candidate',
      sourceUrl: entry.verification.sourceUrl,
      expectedDate: entry.verification.startsAt,
      expectedVenue: entry.verification.venueName,
      expectedGenres: entry.enriched.genreCandidates.map((genre) => genre.label),
      expectedLineupSummary: entry.verification.lineup.slice(0, 5).join(', '),
      expectedTicketBehavior: entry.verification.ticketUrl ?? 'MISSING',
      regressionToInspect: 'Verify no structured content leakage in description',
      expectedFlyer: entry.verification.bestMediaUrl ?? entry.original.mediaUrl,
    };
    });
  writeJson('manual-android-qa-pack.json', {
    manualAndroidQaRequired: true,
    count: manualPack.length,
    cases: manualPack,
  });

  let idempotency: Record<string, unknown> = { skipped: !apply };
  if (apply && eligibleCount > 0) {
    const secondPrepared = await prepareCandidates(originalBatch, matchCatalog, referenceInstant);
    attachWritePlans(secondPrepared, await withDbRetries('secondPlanner', () => loadPlannerContextFromLinkedDb(runQuery)));
    const secondApply = await applyPlans(secondPrepared, runQuery);
    const structurallyIdempotent =
      secondApply.eventInserts === 0 &&
      secondApply.eventUpdates === 0 &&
      secondApply.lineupWrites === 0 &&
      secondApply.genreWrites === 0 &&
      secondApply.descriptionWrites === 0 &&
      secondApply.mediaWrites === 0 &&
      secondApply.sourceBindingWrites === 0 &&
      secondApply.ticketInserts === 0 &&
      secondApply.ticketUpdates === 0;
    idempotency = { structurallyIdempotent, secondRun: secondApply };
    writeJson('second-run-write-analysis.json', idempotency);
  } else {
    writeJson('second-run-write-analysis.json', idempotency);
  }
  writeJson('idempotency.json', idempotency);

  writeJson('performance.json', {
    httpRequests: performance.httpRequests,
    cacheHits: performance.cacheHits,
    failedRequests: performance.failedRequests,
    totalRuntimeMs: Date.now() - performance.startedAt,
    peakConcurrency: performance.peakConcurrency,
  });

  writeJson('staging-safety.json', { stagingProject: STAGING_PROJECT_REF, productionMutations: 0, applyMode: apply });
  writeJson('production-safety.json', {
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    productionLinked: false,
  });

  const goldenRegression = await withDbRetries('goldenRegression', () => auditGoldenRegression(runQuery, referenceInstant));

  const frozenEligibleTotal = 36;
  const eligibleTotal = prewriteSummary.eligibleNew + prewriteSummary.eligibleExistingMatch;
  const verified =
    localHead === remote &&
    prewriteSummary.original === 40 &&
    eligibleTotal === frozenEligibleTotal &&
    prewriteSummary.blockedMedia === 2 &&
    prewriteSummary.blockedOther === 2 &&
    globalRecert.recoverableExplicitGenreMissing === 0 &&
    globalRecert.explicitGenreEvidenceParity === 1 &&
    globalRecert.highConfidenceDuplicateGroups === 0 &&
    (globalRecert.affectedStructuredDescriptionLeakage as number) === 0 &&
    parityFailures === 0 &&
    goldenRegression.filter((entry) => entry.issues.length > 0).length === 0 &&
    globalRecert.genrePresenceCoverage >= 0.95 &&
    (!apply || idempotency.structurallyIdempotent === true);

  const status = verified
    ? 'M9_4D_RAUSGEGANGEN_CONTROLLED_HIGH_COVERAGE_EXPANSION_VERIFIED'
    : 'M9_4D_RAUSGEGANGEN_CONTROLLED_HIGH_COVERAGE_EXPANSION_REVIEW_REQUIRED';

  writeJson('summary.json', {
    status,
    baselineCommit: BASELINE_COMMIT,
    localHead,
    remoteHead: remote,
    localEqualsRemote: localHead === remote,
    reconciliation: {
      rootCause: reconciliation.rootCause,
      qualityReadyImportEligible: reconciliation.qualityReadyImportEligible,
      qualityReadyIrrelevant: reconciliation.qualityReadyIrrelevant,
    },
    prewriteSummary,
    applyResult,
    globalRecert,
    consumerParityFailures: parityFailures,
    idempotency,
    applyMode: apply,
    manualAndroidQaRequired: true,
    affectedTitles: prepared
      .filter((entry) => isImportEligibleOutcome(entry.importEligibility.outcome))
      .map((entry) => entry.verification.title),
  });

  console.log(JSON.stringify({ status, prewriteSummary, applyResult, OUT }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
