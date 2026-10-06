#!/usr/bin/env tsx
/**
 * M9.3B.3 — Apply controlled batch from dry-run artifacts (live re-verify + staging write).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { officialEvidenceToEventCandidate } from '../server/ingestion/adapters/official-evidence-adapter';
import { isPlanIdempotent, planOfficialEventWrites } from '../server/ingestion/planning/event-write-planner';
import { createOfficialEventApplyExecutor } from '../server/ingestion/sync/execute-official-event-apply';
import { executeTicketPersistenceFromResults } from '../server/ingestion/sync/execute-ticket-persistence';
import { loadStagingEventSnapshots } from '../server/ingestion/sync/canonical-consolidation';
import { loadPlannerContextFromLinkedDb } from '../server/ingestion/sync/load-planner-context';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
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
import type { EnrichedTicketIoEvent } from '../server/official-connectors/ticket-evidence/network-discovery/detail-types';
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
import {
  evaluateEventQuality,
  publishedElectronicGenreCoverage,
} from '../server/official-connectors/shared/event-quality/evaluate-event-quality';

const OUT = join(process.cwd(), '..', 'artifacts', 'm9-3b-3-ticketio-germany-expansion');
const BATCH_FILE = join(OUT, 'controlled-batch-selection.json');
const REFERENCE = new Date();

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
}

function berlinDateKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

async function main(): Promise<void> {
  if (!existsSync(BATCH_FILE)) {
    throw new Error(`Missing batch artifact: ${BATCH_FILE}`);
  }
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const batch = JSON.parse(readFileSync(BATCH_FILE, 'utf8')) as {
    selected: EnrichedTicketIoEvent[];
  };

  console.error(`[m9.3b.3-apply] Live re-verifying ${batch.selected.length} candidates...`);
  const liveVerifications = [];
  const preparedForApply = [];

  for (const candidate of batch.selected) {
    const { verification, enriched, fetchResult } = await verifyFirstBatchCandidateLive(
      candidate,
      berlinDateKey(REFERENCE),
    );
    const qualityResult = evaluateImportCandidateQualityContract(enriched);
    const eligibility = isEligibleForControlledImport(verification, REFERENCE);
    const acceptance = passesFirstBatchAcceptanceGate(verification);
    const eligible = eligibility.eligible && acceptance && qualityResult.passesQualityContract;

    liveVerifications.push({ identityKey: candidate.identityKey, verification, eligibility, qualityResult, eligible });

    if (eligible) {
      const evidence = await finalizeControlledImportEvidence(enriched, fetchResult, REFERENCE.toISOString());
      preparedForApply.push({ candidate: enriched, verification, evidence });
    }
  }

  writeJson('prewrite-live-recertification.json', liveVerifications);
  writeJson('quality-contract-results.json', preparedForApply.map((entry) =>
    evaluateImportCandidateQualityContract(entry.candidate),
  ));

  if (preparedForApply.length === 0) {
    throw new Error('No eligible candidates after live recertification');
  }

  console.error(`[m9.3b.3-apply] Applying ${preparedForApply.length} events to staging...`);
  const context = loadPlannerContextFromLinkedDb(runQuery);
  const candidates = preparedForApply.map((entry) => officialEvidenceToEventCandidate(entry.evidence.evidence));
  const plans = planOfficialEventWrites(candidates, context);
  writeJson('apply-plan.json', {
    plans: plans.length,
    planReview: plans.flatMap((plan) => reviewControlledImportWritePlan(plan)),
    mutations: summarizeWritePlanMutations(plans),
  });

  const applyExecutor = createOfficialEventApplyExecutor(runQuery);
  const applyResult = {
    applied: true,
    eventInserts: 0,
    eventUpdates: 0,
    lineupWrites: 0,
    genreWrites: 0,
    ticketWrites: 0,
    sourceBindingWrites: 0,
    productionMutations: 0,
  };

  for (const plan of plans) {
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

  writeJson('apply-result.json', applyResult);

  const sourceKeys = preparedForApply.map((entry) => entry.candidate.identityKey);
  writeJson('canonical-readback.json', loadDbReadbackForSourceKeys(runQuery, sourceKeys));

  const genreAudit = auditGenreCoverage(runQuery);
  const postEvents = loadStagingEventSnapshots(runQuery);
  const postEvaluations = postEvents.map((event) =>
    evaluateEventQuality({
      event,
      genreCoverage: genreAudit.find((entry) => entry.eventId === event.eventId),
    }),
  );
  const combinedGenreCoverage = publishedElectronicGenreCoverage(postEvaluations);
  const baselineBefore = JSON.parse(
    readFileSync(join(OUT, 'baseline-recertification.json'), 'utf8'),
  ) as { genreCoverage: number };

  writeJson('genre-coverage.json', {
    existingGenreCoverageBefore: baselineBefore.genreCoverage,
    combinedGenreCoverageAfter: combinedGenreCoverage,
    combinedGenreCoveragePercent: `${(combinedGenreCoverage * 100).toFixed(1)}%`,
  });

  const duplicateAudit = auditStagingDuplicateGroups(runQuery, REFERENCE);
  const duplicateCounts = countDuplicateGroups(duplicateAudit);
  writeJson('duplicate-audit.json', { groups: duplicateAudit, counts: duplicateCounts });
  writeJson('consumer-parity.json', buildConsumerReadback(runQuery, REFERENCE));
  writeJson('golden-regression.json', auditGoldenRegression(runQuery, REFERENCE));

  const qualitySummary = summarizeQualityContractResults(
    preparedForApply.map((entry) => evaluateImportCandidateQualityContract(entry.candidate)),
  );

  const gate = {
    qualityContractBypass: qualitySummary.qualityContractBypass,
    combinedGenreCoverage,
    highConfidenceDuplicateGroups: duplicateCounts.highConfidenceDuplicateGroups,
    productionMutations: 0,
    verified:
      qualitySummary.qualityContractBypass === 0 &&
      combinedGenreCoverage >= 0.95 &&
      duplicateCounts.highConfidenceDuplicateGroups === 0 &&
      applyResult.eventInserts > 0,
    status: 'REVIEW_REQUIRED',
  };
  if (gate.verified) {
    gate.status = 'M9_3B_3_TICKETIO_GERMANY_NETWORK_EXPANSION_VERIFIED';
  }
  writeJson('summary.json', {
    milestone: 'M9.3B.3',
    apply: applyResult,
    qualitySummary,
    gate,
    baselineHead: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
  });

  console.log(JSON.stringify({ gate, applyResult, qualitySummary }, null, 2));
  await closeDetailFetchBrowser();
}

main().catch(async (error) => {
  console.error(error);
  await closeDetailFetchBrowser();
  process.exit(1);
});
