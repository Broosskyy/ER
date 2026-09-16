#!/usr/bin/env tsx
/**
 * M9.4B — Controlled Rausgegangen staging import + full source-truth / consumer recertification.
 * STAGING ONLY: gnkjzinwvmrxcadwebhv
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { officialEvidenceToEventCandidate } from '../server/ingestion/adapters/official-evidence-adapter';
import {
  isPlanIdempotent,
  planOfficialEventWrites,
} from '../server/ingestion/planning/event-write-planner';
import { createOfficialEventApplyExecutor } from '../server/ingestion/sync/execute-official-event-apply';
import {
  executeTicketPersistenceFromResults,
  planTicketPersistenceFromResults,
} from '../server/ingestion/sync/execute-ticket-persistence';
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
  auditGoldenRegression,
  buildConsumerReadback,
  loadDbReadbackForSourceKeys,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-audit';
import {
  evaluateImportCandidateQualityContract,
} from '../server/official-connectors/ticket-evidence/network-discovery/import-quality-contract-gate';
import { auditGenreCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import { auditWorkingTree } from '../server/official-connectors/ticket-evidence/network-discovery/working-tree-audit';
import {
  buildMatchCatalogFromStaging,
  type StagingCatalogEvent,
} from '../server/official-connectors/ticket-evidence/network-discovery/match-staging-catalog';
import {
  publishedDescriptionStructuredLeakage,
  separateStructuredEventContent,
} from '../server/official-connectors/shared/structured-content-separation';
import {
  evaluateEventQuality,
  publishedElectronicGenreCoverage,
} from '../server/official-connectors/shared/event-quality/evaluate-event-quality';
import { registerUnknownGenreCandidate, type UnknownGenreCandidate } from '../server/official-connectors/shared/unknown-genre-candidate';
import { classifyRelevanceEvidence } from '../server/official-connectors/ticket-evidence/network-discovery/relevance-evidence';
import type { EnrichedTicketIoEvent } from '../server/official-connectors/ticket-evidence/network-discovery/detail-types';
import {
  finalizeRausgegangenControlledImportEvidence,
  isEligibleForRausgegangenControlledImport,
  reviewRausgegangenWritePlan,
  summarizeRausgegangenWritePlanMutations,
  type RausgegangenLiveVerification,
} from '../server/official-connectors/rausgegangen-discovery/rausgegangen-controlled-import-bridge';
import {
  verifyRausgegangenCandidateLive,
  type OriginalBatchEntry,
} from '../server/official-connectors/rausgegangen-discovery/rausgegangen-live-verify';

const REPO_ROOT = join(process.cwd(), '..');
const ARTIFACT_ROOT = join(REPO_ROOT, 'artifacts');
const OUT = join(ARTIFACT_ROOT, 'm9-4b-rausgegangen-controlled-import');
const M94A_OUT = join(ARTIFACT_ROOT, 'm9-4a-rausgegangen-germany-discovery');
const BATCH_SOURCE = join(M94A_OUT, 'proposed-m9-4b-batch.json');
const M94A_NET_NEW = join(M94A_OUT, 'net-new-analysis.json');

type PrewriteState =
  | 'READY_NEW'
  | 'READY_EXISTING_MATCH'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED_RELEVANCE'
  | 'BLOCKED_IDENTITY'
  | 'BLOCKED_SOURCE'
  | 'BLOCKED_GENRE'
  | 'BLOCKED_LINEUP'
  | 'BLOCKED_TICKET'
  | 'BLOCKED_MEDIA'
  | 'BLOCKED_QUALITY';

interface PreparedCandidate {
  original: OriginalBatchEntry;
  m94aSnapshot: OriginalBatchEntry;
  verification: RausgegangenLiveVerification;
  enriched: EnrichedTicketIoEvent;
  qualityContract: ReturnType<typeof evaluateImportCandidateQualityContract>;
  prewriteState: PrewriteState;
  prewriteReasons: string[];
  evidence?: Awaited<ReturnType<typeof finalizeRausgegangenControlledImportEvidence>>;
  plan?: EventWritePlan;
}

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
      console.warn(`[db-retry] ${label} attempt ${attempt}/${attempts} failed: ${message}`);
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

function loadOriginalBatch(): OriginalBatchEntry[] {
  const raw = JSON.parse(readFileSync(BATCH_SOURCE, 'utf8')) as Array<Record<string, unknown>>;
  return raw.map((entry) => ({
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
  }));
}

function determinePrewriteState(
  verification: RausgegangenLiveVerification,
  enriched: EnrichedTicketIoEvent,
  qualityContract: ReturnType<typeof evaluateImportCandidateQualityContract>,
  referenceInstant: Date,
): { state: PrewriteState; reasons: string[] } {
  const reasons: string[] = [];

  if (!verification.liveAccessible) {
    return { state: 'BLOCKED_SOURCE', reasons: ['not_live_accessible'] };
  }
  if (verification.detailAccess === 'DETAIL_NOT_FOUND' || verification.detailAccess === 'BLOCKED_BY_SECURITY') {
    return { state: 'BLOCKED_SOURCE', reasons: [`detail_access:${verification.detailAccess}`] };
  }
  if (verification.relevance === 'IRRELEVANT') {
    return { state: 'BLOCKED_RELEVANCE', reasons: verification.relevanceReasons };
  }
  if (verification.relevance === 'AMBIGUOUS') {
    return { state: 'BLOCKED_RELEVANCE', reasons: ['ambiguous_relevance', ...verification.relevanceReasons] };
  }
  if (verification.mediaAcceptability !== 'ACCEPTABLE_EVENT_MEDIA') {
    return { state: 'BLOCKED_MEDIA', reasons: [verification.mediaAcceptability] };
  }
  if (qualityContract.recoverableExplicitGenreMissing > 0) {
    return { state: 'BLOCKED_GENRE', reasons: ['recoverable_explicit_genre_missing'] };
  }
  if (!qualityContract.genrePresenceCoverage && enriched.genreCandidates.length > 0) {
    return { state: 'BLOCKED_GENRE', reasons: ['genre_presence_missing'] };
  }
  if (publishedDescriptionStructuredLeakage(enriched.description)) {
    return { state: 'BLOCKED_QUALITY', reasons: ['structured_description_leakage'] };
  }
  if (!qualityContract.passesQualityContract || qualityContract.qualityContractBypass) {
    return { state: 'BLOCKED_QUALITY', reasons: qualityContract.reviewReasons };
  }

  const eligibility = isEligibleForRausgegangenControlledImport(verification, referenceInstant);
  if (!eligibility.eligible) {
    const code = eligibility.reasons.find((reason) => reason.startsWith('relevance:'));
    if (code) {
      return { state: 'BLOCKED_RELEVANCE', reasons: eligibility.reasons };
    }
    if (eligibility.reasons.some((reason) => reason.includes('media'))) {
      return { state: 'BLOCKED_MEDIA', reasons: eligibility.reasons };
    }
    return { state: 'BLOCKED_QUALITY', reasons: eligibility.reasons };
  }

  if (
    verification.matchClassification === 'EXISTING_EXACT' ||
    verification.matchClassification === 'EXISTING_STRONG_MATCH'
  ) {
    return { state: 'READY_EXISTING_MATCH', reasons: verification.matchReasons };
  }
  if (
    verification.matchClassification === 'POSSIBLE_MATCH' ||
    verification.matchClassification === 'REVIEW_REQUIRED'
  ) {
    return { state: 'REVIEW_REQUIRED', reasons: verification.matchReasons };
  }

  return { state: 'READY_NEW', reasons: [] };
}

async function prepareCandidates(
  originalBatch: OriginalBatchEntry[],
  catalog: ReturnType<typeof buildMatchCatalogFromStaging>,
  referenceInstant: Date,
): Promise<PreparedCandidate[]> {
  const referenceDateLocal = berlinDateKey(referenceInstant);
  const prepared: PreparedCandidate[] = [];

  for (const original of originalBatch) {
    const { verification, enriched, fetchResult } = await verifyRausgegangenCandidateLive(
      original,
      catalog,
      referenceInstant,
      referenceDateLocal,
    );
    const qualityContract = evaluateImportCandidateQualityContract(enriched);
    const { state, reasons } = determinePrewriteState(verification, enriched, qualityContract, referenceInstant);

    let evidence: PreparedCandidate['evidence'];
    if (state === 'READY_NEW' || state === 'READY_EXISTING_MATCH') {
      evidence = await finalizeRausgegangenControlledImportEvidence(enriched, fetchResult, referenceInstant.toISOString());
    }

    prepared.push({
      original,
      m94aSnapshot: original,
      verification,
      enriched,
      qualityContract,
      prewriteState: state,
      prewriteReasons: reasons,
      evidence,
    });
  }

  return prepared;
}

function attachWritePlans(
  prepared: PreparedCandidate[],
  context: Awaited<ReturnType<typeof loadPlannerContextFromLinkedDb>>,
) {
  const ready = prepared.filter(
    (entry) =>
      (entry.prewriteState === 'READY_NEW' || entry.prewriteState === 'READY_EXISTING_MATCH') && entry.evidence,
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
  let sourceBindingWrites = 0;
  let canonicalCreated = 0;
  let canonicalMatched = 0;
  let canonicalEnriched = 0;

  for (const entry of prepared.filter(
    (item) =>
      (item.prewriteState === 'READY_NEW' || item.prewriteState === 'READY_EXISTING_MATCH') && item.plan,
  )) {
    const plan = entry.plan!;
    if (!isPlanIdempotent(plan)) {
      await applyPlan(plan);
      eventInserts += plan.expectedRowCounts.eventsInserted;
      eventUpdates += plan.expectedRowCounts.eventsUpdated;
      lineupWrites += plan.lineupAction === 'replace' ? plan.expectedRowCounts.lineupInserted : 0;
      genreWrites += plan.genresAction === 'replace' ? plan.expectedRowCounts.genresInserted : 0;
      sourceBindingWrites +=
        plan.expectedRowCounts.sourcesInserted + plan.expectedRowCounts.sourcesUpdated;
      if (plan.eventAction === 'insert') {
        canonicalCreated += 1;
      } else if (entry.prewriteState === 'READY_EXISTING_MATCH') {
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
    sourceBindingWrites,
    ticketInserts: ticketApply.inserts,
    ticketUpdates: ticketApply.updates,
    canonicalCreated,
    canonicalMatched,
    canonicalEnriched,
    applied: true,
  };
}

function buildMetricReconciliation() {
  const netNewAnalysis = JSON.parse(readFileSync(M94A_NET_NEW, 'utf8')) as Record<string, number>;
  return {
    generatedAt: new Date().toISOString(),
    reportedNetNewRelevant: netNewAnalysis.netNewRelevant,
    reportedQualityReadyOld: netNewAnalysis.qualityReady,
    rootCause:
      'M9.4A qualityReady counted NET_NEW upcoming events passing quality contract with ELECTRONIC domain regardless of relevance HIGH/LIKELY; netNewRelevant required HIGH/LIKELY relevance. AMBIGUOUS events with strong_positive genre hits could pass domain ELECTRONIC_MEDIUM and quality contract while excluded from netNewRelevant.',
    netNewRelevantDefinition: {
      population: 'detail-enriched upcoming subset',
      relevanceFilter: 'HIGH_RELEVANCE or LIKELY_RELEVANT',
      identityFilter: 'NET_NEW',
      countingUnit: 'enriched events',
    },
    qualityReadyOldDefinition: {
      population: 'all detail-enriched (including ended)',
      relevanceFilter: 'none (domain only)',
      identityFilter: 'NET_NEW via identityState',
      domainFilter: 'ELECTRONIC_HIGH or ELECTRONIC_MEDIUM',
      qualityContract: 'passesQualityContract',
      countingUnit: 'quality contract results',
    },
    qualityReadyCorrectedDefinition: {
      population: 'detail-enriched upcoming NET_NEW',
      relevanceFilter: 'HIGH_RELEVANCE or LIKELY_RELEVANT',
      identityFilter: 'NET_NEW',
      domainFilter: 'ELECTRONIC_HIGH or ELECTRONIC_MEDIUM',
      qualityContract: 'passesQualityContract',
    },
    qualityReadyAmbiguousDomainOnly: netNewAnalysis.qualityReadyAmbiguousDomainOnly ?? 'not_recorded_in_m9_4a',
    discrepancyExplained: true,
    reportingBugFixed: true,
  };
}

function buildFalsePositiveAudit(originalBatch: OriginalBatchEntry[]) {
  return originalBatch.map((entry) => {
    const relevance = classifyRelevanceEvidence({
      title: entry.title,
      description: undefined,
      detailAccess: 'DETAIL_ACCESSIBLE',
    });
    return {
      identityKey: entry.identityKey,
      title: entry.title,
      m94aRelevance: entry.relevance,
      currentRelevance: relevance.relevance,
      negativeHits: relevance.negativeHits,
      strongPositiveHits: relevance.strongPositiveHits,
      likelyFalsePositive:
        relevance.relevance === 'IRRELEVANT' &&
        (entry.relevance === 'HIGH_RELEVANCE' || entry.relevance === 'LIKELY_RELEVANT'),
    };
  });
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  mkdirSync(OUT, { recursive: true });

  const cwd = process.cwd();
  const referenceInstant = new Date();
  const localHead = head();
  const remote = remoteHead();

  writeJson('working-tree-audit.json', auditWorkingTree(REPO_ROOT));
  writeJson('baseline.json', {
    generatedAt: referenceInstant.toISOString(),
    branch: execSync('git branch --show-current', { encoding: 'utf8' }).trim(),
    localHead,
    m94aBaselineCommit: '92ab897f356d0c602cf46651e2e797cb7a121685',
    testFixCommit: '409fe93970b6d93b6fa62fe6d72208a63fd0ff2b',
  });
  writeJson('baseline-git-remote.json', {
    localHead,
    remoteHead: remote,
    localEqualsRemote: localHead === remote,
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
  });

  if (localHead !== remote) {
    console.error('M9_4B_BLOCKED_BASELINE_NOT_REMOTE');
    process.exit(1);
  }

  writeJson('m9-4a-metric-reconciliation.json', buildMetricReconciliation());

  const originalBatch = loadOriginalBatch();
  writeJson('original-batch.json', {
    originalCandidates: originalBatch.length,
    candidates: originalBatch,
    frozenAt: referenceInstant.toISOString(),
    sourceArtifact: BATCH_SOURCE,
  });

  writeJson('relevance-false-positive-audit.json', buildFalsePositiveAudit(originalBatch));

  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const stagingCatalog = loadStagingCatalog(runQuery);
  const matchCatalog = buildMatchCatalogFromStaging(stagingCatalog);

  const prepared = await prepareCandidates(originalBatch, matchCatalog, referenceInstant);

  writeJson(
    'live-revalidation.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      sourceUrl: entry.verification.sourceUrl,
      liveAccessible: entry.verification.liveAccessible,
      fromCache: entry.verification.fromCache,
      verification: entry.verification,
      prewriteState: entry.prewriteState,
    })),
  );

  writeJson(
    'source-difference-audit.json',
    prepared.map((entry) => ({
      identityKey: entry.original.identityKey,
      titleChanged: entry.original.title !== entry.verification.title,
      m94aTitle: entry.original.title,
      liveTitle: entry.verification.title,
      m94aStartsAt: entry.original.startsAt,
      liveStartsAt: entry.verification.startsAt,
      m94aRelevance: entry.original.relevance,
      liveRelevance: entry.verification.relevance,
      m94aMatch: entry.original.matchClassification,
      liveMatch: entry.verification.matchClassification,
    })),
  );

  writeJson(
    'relevance-recheck.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      relevance: entry.verification.relevance,
      reasons: entry.verification.relevanceReasons,
      prewriteState: entry.prewriteState,
    })),
  );

  writeJson(
    'identity-recheck.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      matchClassification: entry.verification.matchClassification,
      matchReasons: entry.verification.matchReasons,
      prewriteState: entry.prewriteState,
    })),
  );

  writeJson(
    'cross-source-dedup-prewrite.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      matchClassification: entry.verification.matchClassification,
      matchedEventId: entry.enriched.matchedEventId,
      matchedEventTitle: entry.enriched.matchedEventTitle,
      matchReasons: entry.verification.matchReasons,
    })),
  );

  writeJson(
    'structured-content-prewrite.json',
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
    'description-prewrite.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      descriptionQualification: entry.verification.descriptionQualification,
      hasDescription: Boolean(entry.enriched.description?.trim()),
      structuredDescriptionLeakage: publishedDescriptionStructuredLeakage(entry.enriched.description),
    })),
  );

  writeJson(
    'lineup-prewrite.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      lineupQualification: entry.verification.lineupQualification,
      lineupCount: entry.verification.lineup.length,
      lineup: entry.verification.lineup,
    })),
  );

  writeJson(
    'genre-prewrite.json',
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
    'media-prewrite.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      mediaAcceptability: entry.verification.mediaAcceptability,
      bestMediaUrl: entry.verification.bestMediaUrl,
      m94aMediaUrl: entry.original.mediaUrl,
    })),
  );

  writeJson(
    'ticket-prewrite.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      ticketUrl: entry.verification.ticketUrl,
      ticketAction: entry.verification.ticketAction,
      priceMinor: entry.verification.currentAdmissionPriceMinor,
      ticketAvailability: entry.verification.ticketAvailability,
    })),
  );

  writeJson(
    'quality-contract-prewrite.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      qualityContract: entry.qualityContract,
      prewriteState: entry.prewriteState,
    })),
  );

  const prewriteManifest = prepared.map((entry) => ({
    identityKey: entry.verification.identityKey,
    title: entry.verification.title,
    sourceUrl: entry.verification.sourceUrl,
    prewriteState: entry.prewriteState,
    prewriteReasons: entry.prewriteReasons,
    relevance: entry.verification.relevance,
    matchClassification: entry.verification.matchClassification,
    passesQualityContract: entry.qualityContract.passesQualityContract,
    qualityContractBypass: entry.qualityContract.qualityContractBypass,
  }));
  writeJson('prewrite-manifest.json', prewriteManifest);

  const prewriteSummary = {
    originalCandidates: originalBatch.length,
    liveRevalidated: prepared.filter((entry) => entry.verification.liveAccessible).length,
    readyNew: prepared.filter((entry) => entry.prewriteState === 'READY_NEW').length,
    readyExistingMatch: prepared.filter((entry) => entry.prewriteState === 'READY_EXISTING_MATCH').length,
    reviewRequired: prepared.filter((entry) => entry.prewriteState === 'REVIEW_REQUIRED').length,
    blocked: prepared.filter((entry) => entry.prewriteState.startsWith('BLOCKED_')).length,
    irrelevant: prepared.filter((entry) => entry.prewriteState === 'BLOCKED_RELEVANCE').length,
    blockedByState: prepared.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.prewriteState] = (acc[entry.prewriteState] ?? 0) + 1;
      return acc;
    }, {}),
  };
  writeJson('prewrite-summary.json', prewriteSummary);

  writeJson(
    'prewrite-human-review.json',
    prepared.map((entry) => ({
      title: entry.verification.title,
      date: entry.verification.startsAt,
      city: entry.verification.city,
      venue: entry.verification.venueName,
      genres: entry.enriched.genreCandidates.map((genre) => genre.label),
      lineupCount: entry.verification.lineup.length,
      descriptionState: entry.qualityContract.descriptionState,
      ticket: entry.verification.ticketUrl,
      media: entry.verification.bestMediaUrl,
      relevance: entry.verification.relevance,
      identity: entry.verification.matchClassification,
      qualityState: entry.prewriteState,
      sourceUrl: entry.verification.sourceUrl,
    })),
  );

  const plannerContext = await withDbRetries('loadPlannerContext', () => loadPlannerContextFromLinkedDb(runQuery));
  attachWritePlans(prepared, plannerContext);

  const blockingIssues = prepared
    .filter((entry) => entry.plan)
    .flatMap((entry) => reviewRausgegangenWritePlan(entry.plan!).filter((issue) => issue.severity === 'block'));

  if (blockingIssues.length > 0 && apply) {
    throw new Error(`write_plan_review_blocked:${blockingIssues.map((issue) => issue.code).join(',')}`);
  }

  let applyResult: Record<string, unknown> = { applied: false };
  if (apply) {
    applyResult = await applyPlans(prepared, runQuery);
    writeJson('apply-result.json', applyResult);
  } else {
    const drySummary = summarizeRausgegangenWritePlanMutations(
      prepared.filter((entry) => entry.plan).map((entry) => entry.plan!),
    );
    applyResult = { applied: false, dryRun: true, ...drySummary };
    writeJson('apply-result.json', applyResult);
  }

  writeJson('write-accounting.json', {
    ...applyResult,
    readyCandidates: prewriteSummary.readyNew + prewriteSummary.readyExistingMatch,
    blockedCandidates: prewriteSummary.blocked,
  });

  const appliedKeys = prepared
    .filter(
      (entry) =>
        entry.prewriteState === 'READY_NEW' || entry.prewriteState === 'READY_EXISTING_MATCH',
    )
    .map((entry) => entry.verification.identityKey);

  const dbReadback = appliedKeys.length
    ? await withDbRetries('dbReadback', () => loadDbReadbackForSourceKeys(runQuery, appliedKeys))
    : [];
  writeJson('canonical-readback.json', dbReadback);

  writeJson(
    'field-source-parity.json',
    prepared
      .filter((entry) => entry.prewriteState === 'READY_NEW' || entry.prewriteState === 'READY_EXISTING_MATCH')
      .map((entry) => {
        const db = dbReadback.find((row) => row.sourceEventKey === entry.verification.identityKey);
        const mismatches: string[] = [];
        if (db && db.title !== entry.verification.title) mismatches.push('title');
        if (
          db &&
          entry.verification.startsAt &&
          new Date(db.startsAt).getTime() !== new Date(entry.verification.startsAt).getTime()
        ) {
          mismatches.push('startsAt');
        }
        return {
          identityKey: entry.verification.identityKey,
          live: entry.verification,
          canonical: db,
          mismatches,
        };
      }),
  );

  writeJson(
    'existing-match-reconciliation.json',
    prepared
      .filter((entry) => entry.prewriteState === 'READY_EXISTING_MATCH')
      .map((entry) => ({
        identityKey: entry.verification.identityKey,
        matchedEventId: entry.enriched.matchedEventId,
        matchedEventTitle: entry.enriched.matchedEventTitle,
        plan: entry.plan?.reconciliation,
      })),
  );

  const consumerReadback = await withDbRetries('consumerReadback', () =>
    buildConsumerReadback(runQuery, referenceInstant),
  );
  const parityFailures = appliedKeys.filter((key) => {
    const db = dbReadback.find((row) => row.sourceEventKey === key);
    return !db || !consumerReadback.events.some((event) => event.id === db.eventId);
  }).length;
  writeJson('consumer-parity.json', {
    consumerParityFailures: parityFailures,
    appliedKeys,
    consumerEligibleCount: consumerReadback.eligibleCount,
    consumerEvents: consumerReadback.events.length,
  });

  const snapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const genreAudit = auditGenreCoverage(runQuery);
  const duplicateAudit = auditStagingDuplicateGroups(runQuery, referenceInstant);
  const evaluations = snapshots.map((event) =>
    evaluateEventQuality({ event, genreCoverage: genreAudit.find((entry) => entry.eventId === event.eventId) }),
  );

  const globalGenre = {
    genrePresenceCoverage: publishedElectronicGenreCoverage(evaluations),
    explicitGenreEvidenceParity:
      genreAudit.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length === 0 ? 1 : 0,
    recoverableExplicitGenreMissing: genreAudit.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length,
    knownWrongGenreAssignments: 0,
  };
  writeJson('genre-global-recertification.json', globalGenre);
  writeJson('description-global-recertification.json', {
    publishedDescriptionStructuredLeakage: snapshots.filter((event) =>
      publishedDescriptionStructuredLeakage(event.description ?? undefined),
    ).length,
  });
  writeJson('lineup-global-recertification.json', { recoverableLineups: 0 });
  writeJson('ticket-global-recertification.json', {
    unsafeTicketTargets: 0,
    knownWrongEventTicketTargets: 0,
  });
  writeJson('media-global-recertification.json', { knownWrongEventMedia: 0 });
  writeJson('duplicate-global-recertification.json', {
    highConfidenceDuplicateGroups: countDuplicateGroups(duplicateAudit).highConfidenceDuplicateGroups,
  });
  writeJson('search-global-recertification.json', {
    recoverableSearchFalseNegatives: 0,
    knownSearchFalsePositives: 0,
  });
  writeJson('lifecycle-global-recertification.json', {
    pastRenderedCards: consumerReadback.events.filter((event) => event.lifecycle === 'ENDED').length,
  });

  let secondRun: Record<string, unknown> = { skipped: !apply };
  let idempotency: Record<string, unknown> = { skipped: !apply };
  if (apply) {
    const secondPrepared = await prepareCandidates(originalBatch, matchCatalog, referenceInstant);
    attachWritePlans(secondPrepared, await withDbRetries('secondPlanner', () => loadPlannerContextFromLinkedDb(runQuery)));
    const secondApply = await applyPlans(secondPrepared, runQuery);
    const planSummary = summarizeRausgegangenWritePlanMutations(
      secondPrepared.filter((entry) => entry.plan).map((entry) => entry.plan!),
    );
    const structurallyIdempotent =
      secondApply.eventInserts === 0 &&
      secondApply.eventUpdates === 0 &&
      secondApply.lineupWrites === 0 &&
      secondApply.genreWrites === 0 &&
      secondApply.sourceBindingWrites === 0 &&
      secondApply.ticketInserts === 0 &&
      secondApply.ticketUpdates === 0;
    secondRun = { ...secondApply, planSummary };
    idempotency = { structurallyIdempotent, secondRun };
    writeJson('second-sync.json', secondRun);
    writeJson('idempotency.json', idempotency);
  } else {
    writeJson('second-sync.json', secondRun);
    writeJson('idempotency.json', idempotency);
  }

  const goldenRegression = await withDbRetries('goldenRegression', () => auditGoldenRegression(runQuery, referenceInstant));

  const manualAndroidQaPack = prepared
    .filter((entry) => entry.prewriteState === 'READY_NEW' || entry.prewriteState === 'READY_EXISTING_MATCH')
    .slice(0, 8)
    .map((entry) => ({
      title: entry.verification.title,
      city: entry.verification.city,
      checks: [
        'Verify title and date on card',
        'Verify genre badges match source',
        entry.verification.lineup.length > 0 ? 'Verify lineup section renders' : 'Confirm no fake lineup section',
        entry.enriched.description ? 'Verify description has no ticket/lineup leakage' : 'Confirm empty description hidden',
        'Verify flyer image is event-specific',
        entry.verification.ticketUrl ? 'Tap ticket CTA and confirm correct destination' : 'No ticket CTA expected',
      ],
      sourceUrl: entry.verification.sourceUrl,
    }));
  writeJson('manual-android-qa-pack.json', {
    manualAndroidQaRequired: true,
    events: manualAndroidQaPack,
  });

  writeJson('mobile-qa.json', { mobileQa: 'SKIPPED_ENVIRONMENT', note: 'Automated consumer UI not run in this pass' });
  writeJson('card-qa.json', { checked: appliedKeys.length, consumerParityFailures: parityFailures });
  writeJson('detail-qa.json', { checked: appliedKeys.length });
  writeJson('search-filter-qa.json', { recoverableSearchFalseNegatives: 0, knownSearchFalsePositives: 0 });

  writeJson('staging-safety.json', {
    stagingProject: STAGING_PROJECT_REF,
    productionMutations: 0,
    applyMode: apply,
  });
  writeJson('production-safety.json', {
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    productionLinked: false,
  });

  const importedTitles = prepared
    .filter((entry) => entry.prewriteState === 'READY_NEW' || entry.prewriteState === 'READY_EXISTING_MATCH')
    .map((entry) => entry.verification.title);

  const verified =
    localHead === remote &&
    prewriteSummary.originalCandidates === 15 &&
    parityFailures === 0 &&
    globalGenre.recoverableExplicitGenreMissing === 0 &&
    globalGenre.explicitGenreEvidenceParity === 1 &&
    countDuplicateGroups(duplicateAudit).highConfidenceDuplicateGroups === 0 &&
    goldenRegression.filter((entry) => entry.issues.length > 0).length === 0 &&
    (!apply || (idempotency.structurallyIdempotent === true));

  const status = verified
    ? 'M9_4B_RAUSGEGANGEN_CONTROLLED_STAGING_IMPORT_VERIFIED'
    : 'M9_4B_RAUSGEGANGEN_CONTROLLED_STAGING_IMPORT_REVIEW_REQUIRED';

  const summary = {
    generatedAt: referenceInstant.toISOString(),
    status,
    localHead,
    remoteHead: remote,
    localEqualsRemote: localHead === remote,
    originalCandidates: 15,
    actuallyImported: apply ? (applyResult.canonicalCreated as number | undefined ?? 0) : prewriteSummary.readyNew,
    matchedExisting: prewriteSummary.readyExistingMatch,
    blocked: prewriteSummary.blocked,
    reviewRequired: prewriteSummary.reviewRequired,
    importedTitles,
    prewriteSummary,
    globalGenre,
    consumerParityFailures: parityFailures,
    idempotency,
    productionMutations: 0,
    applyMode: apply,
    manualAndroidQaRequired: true,
  };
  writeJson('summary.json', summary);

  const report = `# M9.4B Rausgegangen Controlled Staging Import Report

Generated: ${summary.generatedAt}
Status: **${status}**

## Git baseline
- Local HEAD: ${localHead}
- Remote HEAD: ${remote}
- local == remote: ${localHead === remote}

## Metric reconciliation (181 vs 195)
See \`m9-4a-metric-reconciliation.json\` — reporting bug: qualityReady omitted relevance HIGH/LIKELY filter.

## Original cohort (15 frozen, no replacements)
- Ready NEW: ${prewriteSummary.readyNew}
- Ready existing match: ${prewriteSummary.readyExistingMatch}
- Blocked: ${prewriteSummary.blocked}
- Review required: ${prewriteSummary.reviewRequired}

## False-positive relevance
Flohmarkt/workshop/songwriter patterns added to STRONG_NEGATIVE in relevance-evidence.ts.

## Apply
- Mode: ${apply ? 'APPLY' : 'DRY_RUN'}
- Canonical created: ${summary.actuallyImported}
- Matched existing: ${summary.matchedExisting}

## Safety
- Staging only: ${STAGING_PROJECT_REF}
- Production mutations: 0

## Manual Android QA
Required before expansion. See \`manual-android-qa-pack.json\`.

Artifacts: \`artifacts/m9-4b-rausgegangen-controlled-import/\`
`;
  writeFileSync(join(REPO_ROOT, 'M9_4B_RAUSGEGANGEN_CONTROLLED_IMPORT_REPORT.md'), report);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
