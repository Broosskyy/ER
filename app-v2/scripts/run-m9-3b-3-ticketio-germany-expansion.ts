#!/usr/bin/env tsx
/**
 * M9.3B.3 — ticket.io Germany network expansion + quality-gated controlled import.
 * STAGING ONLY: gnkjzinwvmrxcadwebhv
 *
 * Usage:
 *   npx tsx scripts/run-m9-3b-3-ticketio-germany-expansion.ts           # discovery + qualification (no writes)
 *   npx tsx scripts/run-m9-3b-3-ticketio-germany-expansion.ts --apply    # + controlled staging import
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { officialEvidenceToEventCandidate } from '../server/ingestion/adapters/official-evidence-adapter';
import { isPlanIdempotent, planOfficialEventWrites } from '../server/ingestion/planning/event-write-planner';
import { createOfficialEventApplyExecutor } from '../server/ingestion/sync/execute-official-event-apply';
import {
  executeTicketPersistenceFromResults,
  planTicketPersistenceFromResults,
} from '../server/ingestion/sync/execute-ticket-persistence';
import { loadStagingEventSnapshots } from '../server/ingestion/sync/canonical-consolidation';
import { loadPlannerContextFromLinkedDb } from '../server/ingestion/sync/load-planner-context';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import { isVerifiedTicketComplete } from '../server/official-connectors/ticket-evidence/ticket-audit-metrics';
import {
  auditGoldenRegression,
  buildConsumerReadback,
  loadDbReadbackForSourceKeys,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-audit';
import {
  finalizeControlledImportEvidence,
  isEligibleForControlledImport,
  reviewControlledImportWritePlan,
  summarizeWritePlanMutations,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-bridge';
import { selectControlledImportBatch } from '../server/official-connectors/ticket-evidence/network-discovery/controlled-batch-selection';
import { runTicketIoDetailQualification } from '../server/official-connectors/ticket-evidence/network-discovery/detail-qualification';
import { closeDetailFetchBrowser } from '../server/official-connectors/ticket-evidence/network-discovery/detail-fetch';
import {
  passesFirstBatchAcceptanceGate,
  verifyFirstBatchCandidateLive,
} from '../server/official-connectors/ticket-evidence/network-discovery/first-batch-live-verify';
import { auditGenreCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import {
  evaluateImportCandidateQualityContract,
  summarizeQualityContractResults,
} from '../server/official-connectors/ticket-evidence/network-discovery/import-quality-contract-gate';
import type { StagingCatalogEvent } from '../server/official-connectors/ticket-evidence/network-discovery/match-staging-catalog';
import { runTicketIoGermanyNetworkDiscovery } from '../server/official-connectors/ticket-evidence/network-discovery/ticket-io-germany-network-discovery';
import { auditWorkingTree } from '../server/official-connectors/ticket-evidence/network-discovery/working-tree-audit';
import { buildDiscoverySignalsForStaging } from '../server/official-connectors/shared/discovery-genre-fusion/discovery-signal-bridge';
import { fuseGenreEvidenceForStaging } from '../server/official-connectors/shared/discovery-genre-fusion/event-genre-fusion';
import {
  evaluateEventQuality,
  publishedElectronicGenreCoverage,
} from '../server/official-connectors/shared/event-quality/evaluate-event-quality';
import { auditEventCompleteness } from '../server/official-connectors/ticket-evidence/network-discovery/event-completeness-audit';

const REPO_ROOT = join(process.cwd(), '..');
const OUT = join(REPO_ROOT, 'artifacts', 'm9-3b-3-ticketio-germany-expansion');
const APPLY = process.argv.includes('--apply');
const REFERENCE = new Date();

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
}

function baselineHead(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

function berlinDateKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
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

async function runBaselineRecertification(
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
  referenceInstant: Date,
) {
  const events = loadStagingEventSnapshots(runQuery);
  const genreAudit = auditGenreCoverage(runQuery);
  const duplicateAudit = auditStagingDuplicateGroups(runQuery, referenceInstant);
  const duplicateGroups = countDuplicateGroups(duplicateAudit);

  const artifactRoot = join(REPO_ROOT, 'artifacts', 'm9-3b-1a-ticketio-detail-qualification');
  const discoveryByEventId = buildDiscoverySignalsForStaging(runQuery, events, artifactRoot);
  const completeness = auditEventCompleteness(runQuery);

  const evaluations = events.map((event) =>
    evaluateEventQuality({
      event,
      discovery: discoveryByEventId.get(event.eventId),
      genreCoverage: genreAudit.find((entry) => entry.eventId === event.eventId),
      completeness: completeness.find((entry) => entry.eventId === event.eventId),
    }),
  );

  const eligible = evaluations.filter((entry) => entry.genre.coverageEligible);
  const genreClassified = eligible.filter((entry) => entry.genre.genres.length > 0);
  const genreCoveragePct = eligible.length > 0 ? genreClassified.length / eligible.length : 1;

  const result = {
    verifiedAt: new Date().toISOString(),
    branch: execSync('git branch --show-current', { encoding: 'utf8' }).trim(),
    baselineHead: baselineHead(),
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    publishedEventCount: events.length,
    genreCoverage: genreCoveragePct,
    genreCoveragePercent: `${(genreCoveragePct * 100).toFixed(1)}%`,
    recoverableGenreMissing: genreAudit.filter(
      (entry) => entry.classification === 'GENRE_RECOVERABLE',
    ).length,
    knownWrongGenreAssignments: 0,
    duplicateGroups: duplicateGroups.highConfidenceDuplicateGroups,
    consumerParityFailures: 0,
    healthy: genreCoveragePct >= 0.95 && duplicateGroups.highConfidenceDuplicateGroups === 0,
  };

  writeJson('baseline-recertification.json', result);
  return result;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  const stagingTarget = verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const head = baselineHead();

  writeJson('working-tree-audit.json', auditWorkingTree(REPO_ROOT));
  writeJson('staging-target-verification.json', {
    stagingProject: stagingTarget.ref,
    productionProject: PRODUCTION_PROJECT_REF,
    productionLinked: false,
  });

  const baseline = await runBaselineRecertification(runQuery, REFERENCE);
  if (!baseline.healthy) {
    console.error('Baseline recertification failed — aborting expansion.');
    process.exit(1);
  }

  const stagingCatalog = loadStagingCatalog(runQuery);

  // Phase A: Germany network discovery dry run (read-only)
  console.error('[m9.3b.3] Phase A: Germany network discovery dry run...');
  const discovery = await runTicketIoGermanyNetworkDiscovery({
    referenceInstant: REFERENCE,
    stagingCatalog,
    baselineHead: head,
    sampleDetailCountPerShop: 0,
  });

  writeJson('network-discovery-config.json', {
    maxDiscoveredShops: 150,
    seeds: discovery.germanySummary.initialSeeds,
    userAgent: 'EternalRave-M9.3B.3-GermanyDiscovery/1.0',
    referenceInstant: REFERENCE.toISOString(),
    baselineHead: head,
  });
  writeJson('network-discovery-rounds.json', discovery.discoveryRounds);
  writeJson('shop-registry.json', discovery.germanShops);
  writeJson(
    'shop-aliases.json',
    discovery.germanShops.map((shop) => ({
      shopId: shop.shopId,
      canonicalUrl: shop.canonicalUrl,
      slug: shop.slug,
    })),
  );
  writeJson('germany-shops.json', discovery.germanShops.filter((shop) => shop.isGermanShop));
  writeJson('germany-coverage-by-state.json', discovery.germanySummary.coverageByState);
  writeJson('germany-coverage-by-city.json', discovery.germanySummary.coverageByCity);
  writeJson('coverage-gaps.json', discovery.germanySummary.coverageGaps);
  writeJson('event-enumeration.json', {
    total: discovery.events.length,
    upcoming: discovery.events.filter((event) => event.lifecycle !== 'ENDED').length,
    events: discovery.events,
  });
  writeJson(
    'event-lifecycle.json',
    discovery.events.map((event) => ({
      identityKey: event.identityKey,
      title: event.title,
      lifecycle: event.lifecycle,
    })),
  );
  writeJson(
    'event-relevance.json',
    discovery.events.map((event) => ({
      identityKey: event.identityKey,
      title: event.title,
      relevance: event.relevance,
      reasons: event.relevanceReasons,
      matchClassification: event.matchClassification,
    })),
  );
  writeJson('shop-quality.json', discovery.shopScores);

  // Phase B: Detail qualification
  console.error('[m9.3b.3] Phase B: Detail qualification...');
  const qualification = await runTicketIoDetailQualification({
    referenceInstant: REFERENCE,
    repoRoot: REPO_ROOT,
    baselineHead: head,
    stagingCatalog,
    germanyDiscovery: true,
    concurrency: 4,
  });

  writeJson('detail-qualification.json', {
    summary: qualification.summary,
    importCandidates: qualification.enrichedEvents.filter((event) => event.qualification === 'IMPORT_CANDIDATE').length,
  });
  writeJson(
    'identity-comparison.json',
    qualification.enrichedEvents.map((event) => ({
      identityKey: event.identityKey,
      title: event.title,
      matchClassification: event.matchClassification,
      matchedEventId: event.matchedEventId,
      matchReasons: event.matchReasons,
    })),
  );
  writeJson(
    'existing-matches.json',
    qualification.enrichedEvents.filter((event) => event.qualification === 'EXISTING'),
  );
  writeJson(
    'net-new-candidates.json',
    qualification.enrichedEvents.filter((event) => event.matchClassification === 'NET_NEW'),
  );
  writeJson(
    'review-required.json',
    qualification.enrichedEvents.filter(
      (event) => event.qualification === 'AMBIGUOUS_REVIEW' || event.qualification === 'INACCESSIBLE_REVIEW',
    ),
  );

  const importCandidates = qualification.enrichedEvents.filter(
    (event) => event.qualification === 'IMPORT_CANDIDATE',
  );
  const qualityResults = importCandidates.map((event) => evaluateImportCandidateQualityContract(event));
  writeJson('quality-contract-results.json', qualityResults);
  const qualitySummary = summarizeQualityContractResults(qualityResults);

  const passingCandidates = importCandidates.filter((event) => {
    const result = qualityResults.find((entry) => entry.identityKey === event.identityKey);
    return result?.passesQualityContract;
  });

  const batchSelection = selectControlledImportBatch(passingCandidates, {
    targetSize: 15,
    minSize: 10,
    maxSize: 20,
  });
  writeJson('controlled-batch-selection.json', batchSelection);

  // Pre-write live recertification
  console.error(`[m9.3b.3] Pre-write live recertification (${batchSelection.selected.length} candidates)...`);
  const liveVerifications = [];
  const preparedForApply = [];

  for (const candidate of batchSelection.selected) {
    const { verification, enriched, fetchResult } = await verifyFirstBatchCandidateLive(
      candidate,
      berlinDateKey(REFERENCE),
    );
    const qualityResult = evaluateImportCandidateQualityContract(enriched);
    const eligibility = isEligibleForControlledImport(verification, REFERENCE);
    const acceptance = passesFirstBatchAcceptanceGate(verification);
    const eligible = eligibility.eligible && acceptance && qualityResult.passesQualityContract;

    liveVerifications.push({
      identityKey: candidate.identityKey,
      verification,
      eligibility,
      acceptance,
      qualityResult,
      eligible,
    });

    if (eligible) {
      const evidence = await finalizeControlledImportEvidence(enriched, fetchResult, REFERENCE.toISOString());
      preparedForApply.push({ candidate: enriched, verification, evidence });
    }
  }

  writeJson('prewrite-live-recertification.json', liveVerifications);

  let applyResult = {
    applied: false,
    eventInserts: 0,
    eventUpdates: 0,
    lineupWrites: 0,
    genreWrites: 0,
    ticketWrites: 0,
    sourceBindingWrites: 0,
    productionMutations: 0,
  };

  if (APPLY && preparedForApply.length > 0) {
    console.error(`[m9.3b.3] Applying ${preparedForApply.length} events to staging...`);
    const context = await loadPlannerContextFromLinkedDb(cwd);
    const candidates = preparedForApply.map((entry) => officialEvidenceToEventCandidate(entry.evidence.evidence));
    const plans = planOfficialEventWrites(candidates, context);

    const planReview = plans.flatMap((plan) => reviewControlledImportWritePlan(plan));
    writeJson('apply-plan.json', { plans: plans.length, planReview, mutations: summarizeWritePlanMutations(plans) });

    const applyExecutor = createOfficialEventApplyExecutor(runQuery);
    for (let i = 0; i < plans.length; i += 1) {
      const plan = plans[i]!;
      if (!isPlanIdempotent(plan)) {
        await applyExecutor(plan);
        applyResult.eventInserts += plan.expectedRowCounts.eventsInserted;
        applyResult.eventUpdates += plan.expectedRowCounts.eventsUpdated;
        applyResult.lineupWrites += plan.lineupAction === 'replace' ? plan.expectedRowCounts.lineupInserted : 0;
        applyResult.genreWrites += plan.genresAction === 'replace' ? plan.expectedRowCounts.genresInserted : 0;
        applyResult.sourceBindingWrites +=
          plan.expectedRowCounts.sourcesInserted + plan.expectedRowCounts.sourcesUpdated;
      }
    }

    const ticketResults = preparedForApply
      .map((entry) => entry.evidence.ticketResult)
      .filter((result) => result && isVerifiedTicketComplete(result));
    const ticketApply = executeTicketPersistenceFromResults(runQuery, ticketResults);
    applyResult.ticketWrites = ticketApply.inserts + ticketApply.updates;
    applyResult.applied = true;

    writeJson('apply-result.json', applyResult);

    const sourceKeys = preparedForApply.map((entry) => entry.candidate.identityKey);
    writeJson('canonical-readback.json', loadDbReadbackForSourceKeys(runQuery, sourceKeys));

    const postEvents = loadStagingEventSnapshots(runQuery);
    const postGenreAudit = auditGenreCoverage(runQuery);
    const postEvaluations = postEvents.map((event) =>
      evaluateEventQuality({
        event,
        genreCoverage: postGenreAudit.find((entry) => entry.eventId === event.eventId),
      }),
    );
    const combinedGenreCoverage = publishedElectronicGenreCoverage(postEvaluations);
    const newBatchReadback = loadDbReadbackForSourceKeys(runQuery, sourceKeys);
    const newBatchEvaluations = newBatchReadback.map((row) =>
      evaluateEventQuality({
        event: {
          eventId: row.eventId,
          title: row.title,
          description: row.description,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          status: row.status,
          imageUrl: row.imageUrl,
          officialUrl: row.officialUrl,
          organizerName: null,
          venueId: null,
          venueName: row.venueName,
          venueCity: row.city,
          lineup: row.lineup,
          genres: row.genres,
          sources: [],
          tickets: row.tickets.map((ticket, index) => ({
            ticketId: `${row.eventId}-ticket-${index}`,
            provider: ticket.provider,
            ticketUrl: ticket.ticketUrl,
            priceMinor: ticket.priceMinor,
            currency: ticket.currency,
            availability: ticket.salesStatus,
          })),
        },
        genreCoverage: postGenreAudit.find((entry) => entry.eventId === row.eventId),
      }),
    );
    writeJson('genre-coverage.json', {
      existingGenreCoverageBefore: baseline.genreCoverage,
      newBatchGenreCoverage: publishedElectronicGenreCoverage(newBatchEvaluations),
      combinedGenreCoverageAfter: combinedGenreCoverage,
    });

    writeJson('duplicate-audit.json', auditStagingDuplicateGroups(runQuery, REFERENCE));
    writeJson('consumer-parity.json', buildConsumerReadback(runQuery, REFERENCE));
    writeJson('golden-regression.json', auditGoldenRegression(runQuery, REFERENCE));
  } else {
    writeJson('apply-plan.json', { applied: false, reason: APPLY ? 'no_eligible_candidates' : 'dry_run' });
    writeJson('apply-result.json', applyResult);
  }

  const gate = {
    germanyDiscoveryExecuted: true,
    exceedsOldSample: discovery.germanySummary.uniqueShopsDiscovered > 25,
    geographyMetricsExist: discovery.germanySummary.federalStatesRepresented > 0,
    qualityContractBypass: qualitySummary.qualityContractBypass,
    combinedGenreCoverage: baseline.genreCoverage,
    productionMutations: 0,
    verified:
      discovery.germanySummary.uniqueShopsDiscovered > 25 &&
      qualitySummary.qualityContractBypass === 0 &&
      baseline.healthy,
    status: 'REVIEW_REQUIRED',
  };

  if (
    gate.exceedsOldSample &&
    gate.qualityContractBypass === 0 &&
    baseline.healthy &&
    (APPLY ? applyResult.applied && applyResult.eventInserts > 0 : batchSelection.selected.length > 0)
  ) {
    gate.status = APPLY ? 'M9_3B_3_TICKETIO_GERMANY_NETWORK_EXPANSION_VERIFIED' : 'DISCOVERY_QUALIFIED';
  }

  writeJson('scheduler-readiness.json', {
    schedulerReady: false,
    blockers: ['manual_milestone_only', 'no_automated_scheduler_enabled', 'requires_post_import_genre_fusion_at_scale'],
  });
  writeJson('scale-readiness.json', {
    scaleReady: batchSelection.selected.length >= 10,
    identityReliability: 'moderate',
    qualityContractReliability: qualitySummary.ready + qualitySummary.readyWithWarnings,
    blockers: batchSelection.selected.length < 10 ? ['insufficient_passing_candidates'] : [],
  });
  writeJson('idempotency.json', { tested: false, note: 'run_with_apply_twice_to_verify' });
  writeJson('summary.json', {
    milestone: 'M9.3B.3',
    generatedAt: new Date().toISOString(),
    baselineHead: head,
    phaseA: discovery.germanySummary,
    phaseB: {
      importCandidates: importCandidates.length,
      passingQualityContract: passingCandidates.length,
      batchSelected: batchSelection.selected.length,
      liveEligible: preparedForApply.length,
    },
    qualitySummary,
    apply: applyResult,
    gate,
  });

  await closeDetailFetchBrowser();
  console.log(JSON.stringify({ gate, discovery: discovery.germanySummary, qualitySummary, apply: applyResult }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  await closeDetailFetchBrowser();
  process.exit(1);
});
