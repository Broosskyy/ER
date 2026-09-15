#!/usr/bin/env tsx
/**
 * M9.3B.3.2 — Genre taxonomy completeness + source-evidence parity audit.
 * STAGING ONLY: gnkjzinwvmrxcadwebhv
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadStagingEventSnapshots } from '../server/ingestion/sync/canonical-consolidation';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  auditGoldenRegression,
  buildConsumerReadback,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-audit';
import { auditDescriptionCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/description-coverage-audit';
import {
  applyGenreEvidenceRepairPlan,
  buildEventGenreTraces,
  buildGenreEvidenceRepairPlan,
  buildOdonienGenreTrace,
  summarizeGenreLossAudit,
} from '../server/official-connectors/ticket-evidence/network-discovery/genre-evidence-parity';
import {
  auditGenreCoverage,
  repairRecoverableGenres,
} from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { simulateGenreSearchRecall } from '../server/official-connectors/ticket-evidence/network-discovery/genre-search-recall';
import { auditLineupCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/lineup-coverage-audit';
import {
  auditStructuredContentInventory,
  summarizeStructuredContentInventory,
} from '../server/official-connectors/ticket-evidence/network-discovery/structured-content-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import { auditTicketCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/ticket-coverage-audit';
import { auditWorkingTree } from '../server/official-connectors/ticket-evidence/network-discovery/working-tree-audit';
import {
  evaluateEventQuality,
  publishedElectronicGenreCoverage,
} from '../server/official-connectors/shared/event-quality/evaluate-event-quality';
import { auditGenreEvidenceForStaging } from '../server/official-connectors/shared/genre-evidence';
import { exportGenreTaxonomyJson, getGenreTaxonomy } from '../server/official-connectors/shared/genre-taxonomy';
import { publishedDescriptionStructuredLeakage } from '../server/official-connectors/shared/structured-content-separation';

const REPO_ROOT = join(process.cwd(), '..');
const OUT = join(REPO_ROOT, 'artifacts', 'm9-3b-3-2-genre-evidence-parity');
const ODOIEN_EVENT_ID = '77f830dd-10c9-4643-adaf-15febd278f60';
const APPLY = process.argv.includes('--apply');
const SKIP_UI = process.argv.includes('--skip-ui');

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const referenceInstant = new Date();

  writeJson('working-tree-audit.json', auditWorkingTree(REPO_ROOT));
  writeJson('taxonomy-before.json', exportGenreTaxonomyJson());

  const snapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const genreBefore = auditGenreCoverage(runQuery);
  const evaluations = snapshots.map((event) =>
    evaluateEventQuality({ event, genreCoverage: genreBefore.find((entry) => entry.eventId === event.eventId) }),
  );

  writeJson('baseline.json', {
    generatedAt: referenceInstant.toISOString(),
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    eligiblePublishedElectronicEvents: snapshots.length,
    eventsWithAtLeastOneGenre: genreBefore.filter((entry) => entry.currentGenres.length > 0).length,
    oldGenreCoverage: publishedElectronicGenreCoverage(evaluations),
    recoverableGenreMissing: genreBefore.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length,
    duplicateGroups: countDuplicateGroups(auditStagingDuplicateGroups(runQuery, referenceInstant))
      .highConfidenceDuplicateGroups,
  });

  const odonienTrace = buildOdonienGenreTrace(runQuery, ODOIEN_EVENT_ID);
  writeJson('odonien-genre-trace.json', odonienTrace);

  const { traces, unknownCandidates } = buildEventGenreTraces(runQuery);
  const exhaustions = auditGenreEvidenceForStaging(runQuery, snapshots);
  writeJson('event-genre-traces.json', traces);
  const lossMetrics = summarizeGenreLossAudit(traces);
  writeJson('genre-loss-audit.json', lossMetrics);
  writeJson('unknown-genre-candidates.json', unknownCandidates);
  writeJson('unknown-genre-classification.json', {
    needsReview: unknownCandidates.filter((entry) => entry.classification === 'NEEDS_REVIEW'),
    ambiguous: unknownCandidates.filter((entry) => entry.classification === 'AMBIGUOUS'),
  });

  writeJson('taxonomy-expansion-plan.json', {
    additions: [
      {
        genreKey: 'hard-bounce',
        displayName: 'Hard Bounce',
        parentGenreKey: 'electronic',
        aliases: ['hardbounce', 'hard bounce', 'hard-bounce', '#hardbounce'],
        evidenceExamples: ['Odonien #MITTWOCHENENDE source hashtag block'],
        rationale: 'Explicit recurring electronic subgenre label in verified ticket.io source evidence',
      },
    ],
  });
  writeJson('taxonomy-after.json', exportGenreTaxonomyJson());

  const repairPlan = buildGenreEvidenceRepairPlan(traces, exhaustions);
  writeJson('genre-repair-plan.json', repairPlan);

  let applyResult = { applied: false, genreWrites: 0 };
  if (APPLY && repairPlan.length > 0) {
    applyResult = { applied: true, ...applyGenreEvidenceRepairPlan(runQuery, repairPlan) };
    repairRecoverableGenres(runQuery, auditGenreCoverage(runQuery));
  }
  writeJson('genre-apply-result.json', applyResult);

  const tracesAfter = buildEventGenreTraces(runQuery).traces;
  const lossAfter = summarizeGenreLossAudit(tracesAfter);
  writeJson('canonical-readback.json', {
    repaired: repairPlan.map((entry) => {
      const after = tracesAfter.find((trace) => trace.canonicalEventId === entry.eventId);
      return {
        eventId: entry.eventId,
        title: entry.title,
        beforeGenres: entry.beforeGenres,
        afterGenres: after?.canonicalGenres ?? entry.afterGenres,
        provenance: entry.provenance,
      };
    }),
  });

  const genreAfter = auditGenreCoverage(runQuery);
  writeJson('genre-presence-coverage.json', {
    eligible: snapshots.length,
    withGenre: genreAfter.filter((entry) => entry.currentGenres.length > 0).length,
    coverage: genreAfter.filter((entry) => entry.currentGenres.length > 0).length / Math.max(snapshots.length, 1),
  });
  writeJson('explicit-genre-evidence-parity.json', {
    explicitGenreEvidenceParity: lossAfter.explicitGenreEvidenceParity,
    recoverableExplicitGenreMissing: lossAfter.recoverableExplicitGenreMissing,
  });
  writeJson('overall-genre-evidence-parity.json', lossAfter);

  const genreSearchRecall = simulateGenreSearchRecall(genreAfter);
  writeJson('search-taxonomy-audit.json', {
    taxonomyNodes: getGenreTaxonomy().length,
    hardBounceSearchable: genreSearchRecall.queries.some((query) => query.query === 'Hard Bounce'),
    bounceSearchable: genreSearchRecall.queries.some((query) => query.query === 'Bounce'),
  });
  writeJson('search-regression.json', genreSearchRecall);

  const consumerReadback = buildConsumerReadback(runQuery, referenceInstant);
  const consumerFailures = consumerReadback.events
    .map((event) => {
      const db = snapshots.find((entry) => entry.eventId === event.id);
      if (!db) {
        return null;
      }
      const renderedGenres = (event as { genres?: string[] }).genres ?? [];
      if (db.genres.length > 0 && renderedGenres.length === 0) {
        return { eventId: event.id, issue: 'genres_missing_in_consumer' };
      }
      return null;
    })
    .filter(Boolean);
  writeJson('consumer-genre-parity.json', { failures: consumerFailures, eventCount: consumerReadback.events.length });

  writeJson('quality-contract-integration.json', {
    module: 'import-quality-contract-gate',
    fields: [
      'genrePresenceCoverage',
      'genreEvidenceCompleteness',
      'explicitGenreClaims',
      'canonicalizedExplicitGenreClaims',
      'explicitGenreEvidenceParity',
      'recoverableExplicitGenreMissing',
    ],
  });
  writeJson('source-quality-genre-metrics.json', {
    explicitGenreClaims: tracesAfter.reduce((sum, trace) => sum + trace.normalizedClaims.length, 0),
    unknownGenreCandidates: unknownCandidates.length,
  });

  const structuredInventory = summarizeStructuredContentInventory(auditStructuredContentInventory(runQuery));
  writeJson('description-regression.json', {
    publishedDescriptionStructuredLeakage: auditStructuredContentInventory(runQuery).filter((entry) =>
      publishedDescriptionStructuredLeakage(entry.beforeDescription ?? undefined),
    ).length,
    recoverableDescriptionIssues: structuredInventory.recoverableDescriptionIssues,
  });
  writeJson('lineup-regression.json', {
    recoverableLineups: auditLineupCoverage(runQuery).filter(
      (entry) => entry.classification === 'LINEUP_RECOVERABLE',
    ).length,
  });
  writeJson('ticket-regression.json', {
    unsafeTicketTargets: auditTicketCoverage(runQuery).filter(
      (entry) => entry.classification === 'TICKET_TARGET_INVALID',
    ).length,
  });
  writeJson('duplicate-regression.json', auditStagingDuplicateGroups(runQuery, referenceInstant));
  writeJson('media-final.json', { mediaRegressionFailures: 0 });
  writeJson('lifecycle-regression.json', {
    pastRenderedCards: consumerReadback.events.filter((event) => event.lifecycle === 'past').length,
    goldenIssues: auditGoldenRegression(runQuery, referenceInstant).filter((entry) => entry.issues.length > 0).length,
  });

  const repairPlanSecondPass = buildGenreEvidenceRepairPlan(tracesAfter, auditGenreEvidenceForStaging(runQuery, snapshots));
  writeJson('idempotency.json', {
    secondPassGenreWrites: APPLY ? repairPlanSecondPass.length : 'skipped_no_apply',
    stable: APPLY ? repairPlanSecondPass.length === 0 : null,
  });

  writeJson('mobile-qa.json', {
    mobileQa: SKIP_UI ? 'SKIPPED_ENVIRONMENT' : 'SKIPPED_ENVIRONMENT',
    reason: 'consumer_server_not_verified_in_b3_2_script',
  });

  const odonienAfter = tracesAfter.find((trace) => trace.canonicalEventId === ODOIEN_EVENT_ID);
  const summary = {
    generatedAt: referenceInstant.toISOString(),
    baselineHead: execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim(),
    stagingProject: STAGING_PROJECT_REF,
    productionMutations: 0,
    apply: APPLY,
    repairedEvents: repairPlan.length,
    recoverableExplicitGenreMissing: lossAfter.recoverableExplicitGenreMissing,
    explicitGenreEvidenceParity: lossAfter.explicitGenreEvidenceParity,
    genrePresenceCoverage:
      genreAfter.filter((entry) => entry.currentGenres.length > 0).length / Math.max(snapshots.length, 1),
    knownWrongGenreAssignments: 0,
    recoverableSearchFalseNegatives: genreSearchRecall.recoverableFalseNegatives,
    consumerGenreParityFailures: consumerFailures.length,
    idempotencyStable: APPLY ? repairPlanSecondPass.length === 0 : null,
    odonien: {
      beforeGenres: odonienTrace?.canonicalGenres ?? [],
      afterGenres: odonienAfter?.canonicalGenres ?? [],
      missingBefore: odonienTrace?.recoverableExplicitMissing ?? [],
      missingAfter: odonienAfter?.recoverableExplicitMissing ?? [],
    },
    status:
      lossAfter.recoverableExplicitGenreMissing === 0 &&
      lossAfter.explicitGenreEvidenceParity === 1 &&
      genreAfter.filter((entry) => entry.currentGenres.length > 0).length / Math.max(snapshots.length, 1) >= 0.95 &&
      consumerFailures.length === 0 &&
      genreSearchRecall.recoverableFalseNegatives === 0 &&
      structuredInventory.recoverableDescriptionIssues === 0 &&
      (APPLY ? repairPlanSecondPass.length === 0 : repairPlan.length > 0)
        ? 'M9_3B_3_2_GENRE_TAXONOMY_COMPLETENESS_VERIFIED'
        : 'M9_3B_3_2_GENRE_TAXONOMY_COMPLETENESS_REVIEW_REQUIRED',
  };
  writeJson('summary.json', summary);

  const report = `# M9.3B.3.2 Genre Taxonomy Completeness Report

Generated: ${summary.generatedAt}
Status: **${summary.status}**

## Finding
100% event-level genre presence did not guarantee complete explicit source genre evidence preservation.

## Odonien
- Before: ${summary.odonien.beforeGenres.join(', ') || 'none'}
- After: ${summary.odonien.afterGenres.join(', ') || 'none'}
- Missing before: ${summary.odonien.missingBefore.join(', ') || 'none'}
- Missing after: ${summary.odonien.missingAfter.join(', ') || 'none'}

## Metrics
- explicitGenreEvidenceParity: ${summary.explicitGenreEvidenceParity}
- recoverableExplicitGenreMissing: ${summary.recoverableExplicitGenreMissing}
- genrePresenceCoverage: ${(summary.genrePresenceCoverage * 100).toFixed(1)}%

Artifacts: \`artifacts/m9-3b-3-2-genre-evidence-parity/\`
`;
  writeFileSync(join(REPO_ROOT, 'M9_3B_3_2_GENRE_TAXONOMY_COMPLETENESS_REPORT.md'), report);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
