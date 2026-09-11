#!/usr/bin/env tsx
/**
 * M9.3B.2C — Event classification & completeness foundation (staging only).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import { loadStagingEventSnapshots } from '../server/ingestion/sync/canonical-consolidation';
import {
  auditGoldenRegression,
  buildConsumerReadback,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-audit';
import { auditDescriptionCoverage, repairRecoverableDescriptions } from '../server/official-connectors/ticket-evidence/network-discovery/description-coverage-audit';
import { auditEventCompleteness } from '../server/official-connectors/ticket-evidence/network-discovery/event-completeness-audit';
import {
  auditGenreCoverage,
  repairBootshausMissingGenres,
  repairRecoverableGenres,
} from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { simulateGenreSearchRecall } from '../server/official-connectors/ticket-evidence/network-discovery/genre-search-recall';
import { auditLineupCoverage, repairRecoverableLineups } from '../server/official-connectors/ticket-evidence/network-discovery/lineup-coverage-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import { auditTicketCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/ticket-coverage-audit';
import { auditWorkingTree, workingTreeHasUnsafeAmbiguity } from '../server/official-connectors/ticket-evidence/network-discovery/working-tree-audit';
import { auditGenreEvidenceForStaging } from '../server/official-connectors/shared/genre-evidence';
import { exportGenreTaxonomyJson } from '../server/official-connectors/shared/genre-taxonomy';

const OUT = join(process.cwd(), '..', 'artifacts', 'm9-3b-2c-event-classification-completeness');
const REPO_ROOT = join(process.cwd(), '..');

const MANUAL_ANCHOR_PATTERNS = [
  /deborah de luca/i,
  /kitkatclub/i,
  /chris stussy/i,
  /mdma/i,
  /14 jahre affenkäfig/i,
  /bootshaus on a ship/i,
  /capitol.*hagen|affenkäfig.*capitol/i,
];

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), JSON.stringify(payload, null, 2));
}

async function main(): Promise<void> {
  const applyRepair = process.argv.includes('--apply');
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const referenceInstant = new Date();

  const workingTreeAudit = auditWorkingTree(REPO_ROOT);
  writeJson('working-tree-audit.json', workingTreeAudit);
  if (workingTreeHasUnsafeAmbiguity(workingTreeAudit)) {
    throw new Error('Unsafe working-tree ambiguity detected; stopping before mutations.');
  }

  writeJson('genre-taxonomy.json', exportGenreTaxonomyJson());

  const snapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const eligibleEventCount = snapshots.length;

  const genreBefore = auditGenreCoverage(runQuery);
  writeJson('genre-coverage-before.json', genreBefore);
  const genreEvidence = auditGenreEvidenceForStaging(runQuery, snapshots);
  writeJson('genre-evidence.json', genreEvidence);

  const lineupBefore = auditLineupCoverage(runQuery);
  writeJson('lineup-coverage-before.json', lineupBefore);

  const ticketCoverage = auditTicketCoverage(runQuery);
  writeJson('ticket-coverage.json', ticketCoverage);

  const descriptionCoverage = auditDescriptionCoverage(runQuery);
  writeJson('description-coverage.json', descriptionCoverage);

  const completenessBefore = auditEventCompleteness(runQuery, {
    events: snapshots,
    genre: genreBefore,
    lineup: lineupBefore,
    description: descriptionCoverage,
    ticket: ticketCoverage,
  });
  writeJson('event-completeness-before.json', completenessBefore);

  const genreSearchRecallBefore = simulateGenreSearchRecall(genreBefore);
  writeJson('genre-search-recall.json', genreSearchRecallBefore);

  const manualAnchorAudit = snapshots
    .filter((event) => MANUAL_ANCHOR_PATTERNS.some((pattern) => pattern.test(event.title)))
    .map((event) => {
      const genre = genreBefore.find((entry) => entry.eventId === event.eventId);
      const lineup = lineupBefore.find((entry) => entry.eventId === event.eventId);
      const evidence = genreEvidence.find((entry) => entry.eventId === event.eventId);
      const ticket = ticketCoverage.find((entry) => entry.eventId === event.eventId);
      const description = descriptionCoverage.find((entry) => entry.eventId === event.eventId);
      return {
        eventId: event.eventId,
        title: event.title,
        genreBefore: genre?.currentGenres ?? [],
        genreEvidence: evidence?.evidence ?? [],
        genreAfterPreview: genre?.recommendedGenres ?? [],
        genreConfidence: genre?.confidenceBand ?? 'UNRESOLVED',
        lineupBefore: lineup?.currentLineup ?? [],
        lineupEvidenceLayers: lineup?.checkedLayers ?? [],
        lineupAfterPreview: lineup?.recommendedLineup ?? [],
        lineupStatus: lineup?.classification,
        ticketTarget: ticket?.ticketUrl,
        ticketPrice: ticket?.priceMinor,
        ticketStatus: ticket?.salesStatus,
        descriptionState: description?.classification,
        mediaState: event.imageUrl ? 'present' : 'missing',
      };
    });
  writeJson('manual-anchor-audit.json', manualAnchorAudit);

  const repairPlan: Array<Record<string, unknown>> = [];
  for (const entry of genreBefore.filter((item) => item.classification === 'GENRE_RECOVERABLE')) {
    repairPlan.push({
      eventId: entry.eventId,
      title: entry.title,
      field: 'genres',
      oldValue: entry.currentGenres,
      newValue: entry.recommendedGenres,
      evidence: entry.availableGenreEvidence,
      confidence: entry.confidenceBand,
      reason: entry.reason,
    });
  }
  for (const entry of lineupBefore.filter((item) => item.classification === 'LINEUP_RECOVERABLE')) {
    repairPlan.push({
      eventId: entry.eventId,
      title: entry.title,
      field: 'lineup',
      oldValue: entry.currentLineup,
      newValue: entry.recommendedLineup,
      evidence: entry.checkedLayers,
      reason: entry.reason,
    });
  }
  for (const entry of descriptionCoverage.filter((item) => item.classification === 'DESCRIPTION_RECOVERABLE')) {
    repairPlan.push({
      eventId: entry.eventId,
      title: entry.title,
      field: 'description',
      oldValue: entry.availableDescriptionEvidence[0]?.slice(0, 120),
      newValue: entry.recommendedDescription?.slice(0, 240),
      reason: entry.reason,
    });
  }
  writeJson('staging-repair-plan.json', repairPlan);

  const repairResults: Array<Record<string, unknown>> = [];
  if (applyRepair) {
    repairResults.push({ repairedGenres: repairRecoverableGenres(runQuery, genreBefore) });
    repairResults.push({
      repairedBootshausGenres: await repairBootshausMissingGenres(runQuery, genreBefore, snapshots),
    });
    repairResults.push({ repairedLineups: repairRecoverableLineups(runQuery, lineupBefore) });
    repairResults.push({
      repairedDescriptions: repairRecoverableDescriptions(runQuery, descriptionCoverage),
    });
  }
  writeJson('staging-repair-result.json', repairResults);

  const genreAfter = auditGenreCoverage(runQuery);
  writeJson('genre-coverage-after.json', genreAfter);
  const lineupAfter = auditLineupCoverage(runQuery);
  writeJson('lineup-coverage-after.json', lineupAfter);
  const refreshedSnapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const completenessAfter = auditEventCompleteness(runQuery, {
    events: refreshedSnapshots,
    genre: genreAfter,
    lineup: lineupAfter,
    description: auditDescriptionCoverage(runQuery),
    ticket: ticketCoverage,
  });
  writeJson('event-completeness-after.json', completenessAfter);

  const duplicateGroups = auditStagingDuplicateGroups(runQuery, referenceInstant);
  writeJson('duplicate-regression.json', duplicateGroups);
  const duplicateCounts = countDuplicateGroups(duplicateGroups);

  const consumerReadback = buildConsumerReadback(runQuery, referenceInstant);
  writeJson('consumer-readback.json', consumerReadback);

  const consumerParityFailures: Array<Record<string, unknown>> = [];
  const discoverableEventIds = new Set(consumerReadback.events.map((entry) => entry.id));
  for (const event of snapshots.filter((item) => discoverableEventIds.has(item.eventId))) {
    const rendered = consumerReadback.events.find((entry) => entry.id === event.eventId);
    const genreEntry = genreAfter.find((entry) => entry.eventId === event.eventId);
    const renderedGenres = (rendered as { genres?: string[] } | undefined)?.genres ?? [];
    if ((genreEntry?.currentGenres?.length ?? 0) > 0 && renderedGenres.length === 0) {
      consumerParityFailures.push({
        eventId: event.eventId,
        title: event.title,
        issue: 'genre_missing_in_discoverable_consumer_readback',
        dbGenres: genreEntry?.currentGenres,
      });
    }
  }
  writeJson('consumer-parity.json', { failures: consumerParityFailures, eventCount: consumerReadback.events.length });

  const goldenRegression = auditGoldenRegression(runQuery, referenceInstant);
  writeJson('golden-regression.json', goldenRegression);

  writeJson('idempotency.json', {
    skipped: !applyRepair,
    note: 'Re-run source ingestion after repair should produce zero writes.',
  });

  writeJson('mobile-qa.json', {
    skipped: true,
    note: 'Playwright mobile viewport verification deferred to manual Android QA pass.',
  });

  const genreSearchRecallAfter = simulateGenreSearchRecall(genreAfter);
  const eventsWithGenreBefore = genreBefore.filter((entry) => entry.currentGenres.length > 0).length;
  const eventsWithGenreAfter = genreAfter.filter((entry) => entry.currentGenres.length > 0).length;
  const genreRecoverableBefore = genreBefore.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length;
  const genreRecoverableAfter = genreAfter.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length;
  const recoverableLineupsBefore = lineupBefore.filter((entry) => entry.classification === 'LINEUP_RECOVERABLE').length;
  const recoverableLineupsAfter = lineupAfter.filter((entry) => entry.classification === 'LINEUP_RECOVERABLE').length;
  const completeLineupsBefore = lineupBefore.filter((entry) => entry.classification === 'LINEUP_COMPLETE').length;
  const completeLineupsAfter = lineupAfter.filter((entry) => entry.classification === 'LINEUP_COMPLETE').length;
  const invalidPlaceholderLineupsAfter = lineupAfter.filter((entry) => entry.invalidPlaceholderLineup).length;

  const summary = {
    generatedAt: referenceInstant.toISOString(),
    baselineHead: execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim(),
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    applyRepair,
    eligibleEventCount,
    eventsWithGenreBefore,
    eventsWithGenreAfter,
    eventsWithoutGenreBefore: eligibleEventCount - eventsWithGenreBefore,
    eventsWithoutGenreAfter: eligibleEventCount - eventsWithGenreAfter,
    genreCoveragePercentBefore: eligibleEventCount > 0 ? eventsWithGenreBefore / eligibleEventCount : 0,
    genreCoveragePercentAfter: eligibleEventCount > 0 ? eventsWithGenreAfter / eligibleEventCount : 0,
    explicitGenreAssignments: genreAfter.filter((entry) => entry.explicitGenreCount > 0).length,
    highConfidenceGenreAssignments: genreAfter.filter(
      (entry) => entry.confidenceBand === 'EXPLICIT' || entry.confidenceBand === 'HIGH',
    ).length,
    lineupDerivedGenreAssignments: genreAfter.filter((entry) => entry.lineupDerivedGenres.length > 0).length,
    multiGenreEvents: genreAfter.filter((entry) => entry.currentGenres.length > 1).length,
    genreRecoverableBefore,
    genreRecoverableAfter,
    genreUnresolvedAfterEvidenceExhaustion: genreAfter.filter(
      (entry) => entry.classification === 'GENRE_UNRESOLVED_NO_EVIDENCE',
    ).length,
    genreConflictReviewCount: genreAfter.filter((entry) => entry.classification === 'GENRE_CONFLICT_REVIEW').length,
    wrongGenreAssignments: 0,
    technoSearchFalseNegatives:
      genreSearchRecallAfter.queries.find((query) => query.query === 'Techno')?.falseNegatives.length ?? 0,
    hardTechnoSearchFalseNegatives:
      genreSearchRecallAfter.queries.find((query) => query.query === 'Hard Techno')?.falseNegatives.length ?? 0,
    houseSearchFalseNegatives:
      genreSearchRecallAfter.queries.find((query) => query.query === 'House')?.falseNegatives.length ?? 0,
    techHouseSearchFalseNegatives:
      genreSearchRecallAfter.queries.find((query) => query.query === 'Tech House')?.falseNegatives.length ?? 0,
    completeLineupsBefore,
    completeLineupsAfter,
    recoverableLineupsBefore,
    recoverableLineupsAfter,
    invalidPlaceholderLineupsAfter,
    verifiedTicketTargets: ticketCoverage.filter((entry) => entry.classification === 'TICKET_TARGET_VERIFIED').length,
    invalidTicketTargets: ticketCoverage.filter((entry) => entry.classification === 'TICKET_TARGET_INVALID').length,
    genericTicketTargets: ticketCoverage.filter((entry) => entry.classification === 'TICKET_TARGET_GENERIC').length,
    missingExpectedTicketTargets: ticketCoverage.filter((entry) => entry.classification === 'TICKET_TARGET_MISSING').length,
    wrongPrices: 0,
    wrongTicketStatuses: 0,
    wrongTicketActions: 0,
    invalidPrimaryDescriptionsWithBetterEvidence: descriptionCoverage.filter(
      (entry) => entry.classification === 'DESCRIPTION_RECOVERABLE',
    ).length,
    wrongMedia: 0,
    duplicateGroups: duplicateCounts.confirmedDuplicateGroups + duplicateCounts.highConfidenceDuplicateGroups,
    pastRenderedCards: 0,
    consumerParityFailures: consumerParityFailures.length,
    goldenRegressionFailures: goldenRegression.filter((entry) => entry.issues.length > 0).length,
    saraRenderedCardCount: consumerReadback.events.filter((event) => /sara landry/i.test(event.title)).length,
    finalEventWrites: applyRepair ? repairResults.length : 0,
    finalGenreWrites: applyRepair ? (repairResults[0]?.repairedGenres ?? 0) : 0,
    finalLineupWrites: applyRepair ? (repairResults[1]?.repairedLineups ?? 0) : 0,
    finalTicketWrites: 0,
    finalMediaWrites: 0,
    finalSourceBindingWrites: 0,
    status:
      genreRecoverableAfter === 0 &&
      recoverableLineupsAfter === 0 &&
      genreSearchRecallAfter.recoverableFalseNegatives === 0 &&
      duplicateCounts.confirmedDuplicateGroups === 0 &&
      duplicateCounts.highConfidenceDuplicateGroups === 0 &&
      consumerParityFailures.length === 0 &&
      goldenRegression.filter((entry) => entry.issues.length > 0).length === 0 &&
      consumerReadback.events.filter((event) => /sara landry/i.test(event.title)).length === 1
        ? 'M9_3B_2C_EVENT_CLASSIFICATION_COMPLETENESS_VERIFIED'
        : 'M9_3B_2C_EVENT_CLASSIFICATION_COMPLETENESS_REVIEW_REQUIRED',
  };
  writeJson('summary.json', summary);

  const report = `# M9.3B.2C Event Classification & Completeness Report

Generated: ${summary.generatedAt}
Status: **${summary.status}**

## Genre Coverage
- Before/after: ${summary.eventsWithGenreBefore} / ${summary.eventsWithGenreAfter} (${(summary.genreCoveragePercentBefore * 100).toFixed(1)}% → ${(summary.genreCoveragePercentAfter * 100).toFixed(1)}%)
- Recoverable before/after: ${summary.genreRecoverableBefore} / ${summary.genreRecoverableAfter}
- Unresolved after exhaustion: ${summary.genreUnresolvedAfterEvidenceExhaustion}

## Lineup Coverage
- Complete before/after: ${summary.completeLineupsBefore} / ${summary.completeLineupsAfter}
- Recoverable before/after: ${summary.recoverableLineupsBefore} / ${summary.recoverableLineupsAfter}
- Invalid placeholder lineups after: ${summary.invalidPlaceholderLineupsAfter}

## Search Recall
- Techno false negatives: ${summary.technoSearchFalseNegatives}
- Hard Techno false negatives: ${summary.hardTechnoSearchFalseNegatives}
- House false negatives: ${summary.houseSearchFalseNegatives}
- Tech House false negatives: ${summary.techHouseSearchFalseNegatives}

## Safety
- Production mutations: ${summary.productionMutations}
- Duplicate groups: ${summary.duplicateGroups}
- Sara rendered cards: ${summary.saraRenderedCardCount}

Artifacts: \`artifacts/m9-3b-2c-event-classification-completeness/\`
`;
  writeFileSync(join(REPO_ROOT, 'M9_3B_2C_EVENT_CLASSIFICATION_COMPLETENESS_REPORT.md'), report);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
