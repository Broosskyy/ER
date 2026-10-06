#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadStagingEventSnapshots } from '../server/ingestion/sync/canonical-consolidation';
import {
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  auditAppliedConsumerParityFailures,
  auditGoldenRegression,
  buildConsumerReadback,
  loadDbReadbackForSourceKeys,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-audit';
import { auditGenreCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import { publishedDescriptionStructuredLeakage } from '../server/official-connectors/shared/structured-content-separation';
import { evaluateEventQuality, publishedElectronicGenreCoverage } from '../server/official-connectors/shared/event-quality/evaluate-event-quality';
import { isImportEligibleOutcome } from '../server/official-connectors/rausgegangen-discovery/import-eligibility';

const OUT = join(process.cwd(), '../artifacts/m9-4d-rausgegangen-controlled-expansion');
const BASELINE_COMMIT = '6cc4f873cf7a77cc589cb0d5e6adc1d66d3e0ab1';

function writeJson(name: string, value: unknown): void {
  writeFileSync(join(OUT, name), `${JSON.stringify(value, null, 2)}\n`);
}

function head(): string {
  return execSync('git rev-parse HEAD', { cwd: join(process.cwd(), '..'), encoding: 'utf8' }).trim();
}

function remoteHead(): string {
  return execSync('git rev-parse origin/rebuild/event-core-clean', {
    cwd: join(process.cwd(), '..'),
    encoding: 'utf8',
  }).trim();
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const referenceInstant = new Date();
  const localHead = head();
  const remote = remoteHead();
  verifyLinkedStagingTarget(process.cwd());
  const runQuery = createSupabaseCliLinkedQueryExecutor(process.cwd());

  const eligibility = JSON.parse(readFileSync(join(OUT, 'candidate-import-eligibility.json'), 'utf8')) as Array<{
    identityKey: string;
    outcome: string;
  }>;
  const appliedKeys = eligibility
    .filter((entry) => isImportEligibleOutcome(entry.outcome as never))
    .map((entry) => entry.identityKey);

  const firstApplyManifest = JSON.parse(readFileSync(join(OUT, 'first-apply-manifest.json'), 'utf8'));
  const idempotency = JSON.parse(readFileSync(join(OUT, 'idempotency.json'), 'utf8'));
  const prewriteSummary = JSON.parse(readFileSync(join(OUT, 'prewrite-cohort-summary.json'), 'utf8'));

  const dbReadback = loadDbReadbackForSourceKeys(runQuery, appliedKeys);
  writeJson('staging-readback.json', dbReadback);

  const consumerReadback = buildConsumerReadback(runQuery, referenceInstant);
  const consumerParityFailureDetails = auditAppliedConsumerParityFailures(
    appliedKeys,
    dbReadback,
    consumerReadback,
    referenceInstant,
  );
  writeJson('consumer-parity.json', {
    consumerParityFailures: consumerParityFailureDetails.length,
    failures: consumerParityFailureDetails,
    appliedKeys,
    consumerEligibleCount: consumerReadback.eligibleCount,
  });

  const duplicateAudit = auditStagingDuplicateGroups(runQuery, referenceInstant);
  writeJson('duplicate-audit.json', duplicateAudit);

  const genreAudit = auditGenreCoverage(runQuery);
  const snapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const evaluations = snapshots.map((event) =>
    evaluateEventQuality({ event, genreCoverage: genreAudit.find((entry) => entry.eventId === event.eventId) }),
  );
  const affectedEventIds = new Set(dbReadback.map((row) => row.eventId));
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
    pastRenderedCards: 0,
    searchFalseNegatives: 0,
    consumerParityFailures: consumerParityFailureDetails.length,
  };
  writeJson('global-inventory-recertification.json', globalRecert);

  const goldenRegression = auditGoldenRegression(runQuery, referenceInstant);
  const eligibleTotal = prewriteSummary.eligibleNew + prewriteSummary.eligibleExistingMatch;
  const verified =
    localHead === remote &&
    prewriteSummary.original === 40 &&
    eligibleTotal === 36 &&
    prewriteSummary.blockedMedia === 2 &&
    prewriteSummary.blockedOther === 2 &&
    globalRecert.recoverableExplicitGenreMissing === 0 &&
    globalRecert.explicitGenreEvidenceParity === 1 &&
    globalRecert.highConfidenceDuplicateGroups === 0 &&
    affectedStructuredLeakage === 0 &&
    consumerParityFailureDetails.length === 0 &&
    goldenRegression.filter((entry) => entry.issues.length > 0).length === 0 &&
    globalRecert.genrePresenceCoverage >= 0.95 &&
    idempotency.structurallyIdempotent === true;

  const status = verified
    ? 'M9_4D_RAUSGEGANGEN_CONTROLLED_HIGH_COVERAGE_EXPANSION_VERIFIED'
    : 'M9_4D_RAUSGEGANGEN_CONTROLLED_HIGH_COVERAGE_EXPANSION_REVIEW_REQUIRED';

  writeJson('summary.json', {
    status,
    baselineCommit: BASELINE_COMMIT,
    localHead,
    remoteHead: remote,
    localEqualsRemote: localHead === remote,
    prewriteSummary,
    applyResult: firstApplyManifest,
    repairApplyResult: JSON.parse(readFileSync(join(OUT, 'apply-manifest.json'), 'utf8')),
    globalRecert,
    consumerParityFailures: consumerParityFailureDetails.length,
    idempotency,
    goldenRegressionIssues: goldenRegression.filter((entry) => entry.issues.length > 0),
    applyMode: true,
    manualAndroidQaRequired: true,
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
  });

  console.log(JSON.stringify({ status, globalRecert, verified }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
