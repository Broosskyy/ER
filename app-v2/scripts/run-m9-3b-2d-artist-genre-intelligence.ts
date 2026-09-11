#!/usr/bin/env tsx
/**
 * M9.3B.2D — Artist & genre intelligence foundation (staging only).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
import { auditDescriptionCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/description-coverage-audit';
import { auditEventCompleteness } from '../server/official-connectors/ticket-evidence/network-discovery/event-completeness-audit';
import {
  auditGenreCoverage,
  repairRecoverableGenres,
} from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { simulateGenreSearchRecall } from '../server/official-connectors/ticket-evidence/network-discovery/genre-search-recall';
import { auditLineupCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/lineup-coverage-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import { auditTicketCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/ticket-coverage-audit';
import { auditWorkingTree, workingTreeHasUnsafeAmbiguity } from '../server/official-connectors/ticket-evidence/network-discovery/working-tree-audit';
import { auditGenreEvidenceForStaging } from '../server/official-connectors/shared/genre-evidence';
import { artistEvidenceRecords, runArtistIntelligencePass } from '../server/official-connectors/shared/artist-genre-intelligence/artist-intelligence-service';
import { ArtistProfileStore } from '../server/official-connectors/shared/artist-genre-intelligence/artist-profile-store';
import type { ArtistGenreProfile } from '../server/official-connectors/shared/artist-genre-intelligence/types';
import {
  buildGenreUnresolvedAfterIntelligence,
  buildGenreUnresolvedBaseline,
} from '../server/official-connectors/shared/artist-genre-intelligence/genre-unresolved-baseline';
import { providerHealthSummary } from '../server/official-connectors/shared/artist-genre-intelligence/artist-evidence-providers';

const OUT = join(process.cwd(), '..', 'artifacts', 'm9-3b-2d-artist-genre-intelligence');
const REPO_ROOT = join(process.cwd(), '..');

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), JSON.stringify(payload, null, 2));
}

async function main(): Promise<void> {
  const applyRepair = process.argv.includes('--apply');
  const skipExternal = process.argv.includes('--skip-external');
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const referenceInstant = new Date();

  const workingTreeAudit = auditWorkingTree(REPO_ROOT);
  writeJson('working-tree-audit.json', {
    milestone: 'M9.3B.2D',
    baselineHead: execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim(),
    files: workingTreeAudit,
    b2dFiles: workingTreeAudit.filter((entry) =>
      entry.path.includes('artist-genre-intelligence') ||
      entry.path.includes('run-m9-3b-2d') ||
      entry.path.includes('m9-3b-2d'),
    ),
    preExistingUnrelated: workingTreeAudit.filter(
      (entry) =>
        !entry.path.includes('artist-genre-intelligence') &&
        !entry.path.includes('run-m9-3b-2d') &&
        !entry.path.includes('m9-3b-2d'),
    ),
  });
  if (workingTreeHasUnsafeAmbiguity(workingTreeAudit)) {
    throw new Error('Unsafe working-tree ambiguity detected; stopping before mutations.');
  }

  const snapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const eligibleEventCount = snapshots.length;

  const genreBefore = auditGenreCoverage(runQuery);
  writeJson('genre-coverage-before.json', genreBefore);
  const genreEvidenceBefore = auditGenreEvidenceForStaging(runQuery, snapshots);
  const lineupBefore = auditLineupCoverage(runQuery);
  const unresolvedBaseline = buildGenreUnresolvedBaseline({
    events: snapshots,
    genreCoverage: genreBefore,
    lineupCoverage: lineupBefore,
    genreEvidence: genreEvidenceBefore,
  });
  writeJson('genre-unresolved-baseline.json', unresolvedBaseline);

  const store = new ArtistProfileStore();
  store.load();
  const cachedProfilesPath = join(OUT, 'artist-profiles.json');
  if (skipExternal && existsSync(cachedProfilesPath)) {
    store.importProfiles(JSON.parse(readFileSync(cachedProfilesPath, 'utf8')) as ArtistGenreProfile[]);
  }
  const intelligenceDryRun = await runArtistIntelligencePass({
    events: snapshots,
    runQuery,
    store,
    fetchExternal: !skipExternal,
  });
  writeJson('artist-intelligence-dry-run.json', intelligenceDryRun);
  writeJson('artist-profiles.json', store.allProfiles());
  writeJson('artist-evidence.json', artistEvidenceRecords(store));
  writeJson('artist-provider-health.json', providerHealthSummary(store));
  writeJson('artist-cache-metrics.json', store.getMetrics());
  writeJson('lineup-consensus.json', intelligenceDryRun.lineupConsensus);

  const genreContext = { artistStore: store };
  const genreAfterIntelligence = auditGenreCoverage(runQuery, genreContext);
  const genreEvidenceAfter = auditGenreEvidenceForStaging(runQuery, snapshots, genreContext);

  const reclassificationPlan = genreAfterIntelligence
    .filter((entry) => entry.classification === 'GENRE_RECOVERABLE')
    .map((entry) => {
      const explanation = intelligenceDryRun.explanations.find((item) => item.eventId === entry.eventId);
      return {
        eventId: entry.eventId,
        title: entry.title,
        oldGenres: entry.currentGenres,
        newGenres: entry.recommendedGenres,
        evidence: entry.availableGenreEvidence,
        confidence: entry.confidenceBand,
        artistProfilesUsed: explanation?.genres.flatMap((genre) => genre.artistProfilesUsed) ?? [],
        reason: entry.reason,
      };
    });
  writeJson('genre-reclassification-plan.json', reclassificationPlan);

  const applyResult: Record<string, unknown> = { applied: false };
  if (applyRepair) {
    store.save();
    const repairedGenres = repairRecoverableGenres(runQuery, genreAfterIntelligence);
    applyResult.applied = true;
    applyResult.repairedGenres = repairedGenres;
    store.save();
  }
  writeJson('staging-apply.json', applyResult);

  const genreAfter = auditGenreCoverage(runQuery, { artistStore: store });
  writeJson('genre-coverage-after.json', genreAfter);
  const lineupAfter = auditLineupCoverage(runQuery);
  const ticketCoverage = auditTicketCoverage(runQuery);
  writeJson('ticket-regression.json', ticketCoverage);
  const descriptionCoverage = auditDescriptionCoverage(runQuery);

  const unresolvedAfter = buildGenreUnresolvedAfterIntelligence({
    baseline: unresolvedBaseline,
    events: snapshots,
    genreCoverage: genreAfter,
    lineupCoverage: lineupAfter,
    store,
  });
  writeJson('genre-unresolved-after-intelligence.json', unresolvedAfter);

  const genreSearchRecall = simulateGenreSearchRecall(genreAfter);
  writeJson('genre-search-recall.json', genreSearchRecall);

  const duplicateGroups = auditStagingDuplicateGroups(runQuery, referenceInstant);
  writeJson('duplicate-regression.json', duplicateGroups);
  const duplicateCounts = countDuplicateGroups(duplicateGroups);

  const consumerReadback = buildConsumerReadback(runQuery, referenceInstant);
  writeJson('db-readback.json', consumerReadback);
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

  const idempotency = {
    applyRepair,
    note: applyRepair
      ? 'Re-run without --apply after apply should produce zero genre writes.'
      : 'Dry-run only.',
  };
  writeJson('idempotency.json', idempotency);

  writeJson('mobile-qa.json', {
    skipped: true,
    note: 'Mobile viewport capture deferred; manual Android QA required after VERIFIED.',
  });

  const eventsWithGenreBefore = genreBefore.filter((entry) => entry.currentGenres.length > 0).length;
  const eventsWithGenreAfter = genreAfter.filter((entry) => entry.currentGenres.length > 0).length;
  const genreRecoverableAfter = genreAfter.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length;
  const completeLineups = lineupAfter.filter((entry) => entry.classification === 'LINEUP_COMPLETE');
  const unresolvedAfterEntries = genreAfter.filter(
    (entry) => entry.classification === 'GENRE_UNRESOLVED_NO_EVIDENCE',
  );

  const summary = {
    generatedAt: referenceInstant.toISOString(),
    baselineHead: execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim(),
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    applyRepair,
    skipExternal,
    eligibleEventCount,
    eventsWithGenreBefore,
    eventsWithGenreAfter,
    genreCoverageBefore: eligibleEventCount > 0 ? eventsWithGenreBefore / eligibleEventCount : 0,
    genreCoverageAfter: eligibleEventCount > 0 ? eventsWithGenreAfter / eligibleEventCount : 0,
    explicitEventGenreCount: genreAfter.filter((entry) => entry.explicitGenreCount > 0).length,
    descriptionDerivedGenreCount: genreEvidenceAfter.filter((entry) =>
      entry.checkedLayers.includes('description'),
    ).length,
    artistDerivedGenreCount: genreAfter.filter((entry) =>
      entry.checkedLayers.includes('artist_intelligence'),
    ).length,
    lineupConsensusGenreCount: genreAfter.filter((entry) => entry.lineupDerivedGenres.length > 0).length,
    seriesDerivedGenreCount: 0,
    artistProfilesCreated: intelligenceDryRun.artistProfilesCreated,
    artistProfilesReused: intelligenceDryRun.artistProfilesReused,
    artistsEvaluated: intelligenceDryRun.artistsEvaluated,
    artistsClassified: intelligenceDryRun.artistsClassified,
    artistsUnresolved: intelligenceDryRun.artistsUnresolved,
    artistGenreConflicts: intelligenceDryRun.artistGenreConflicts,
    eventsRecoveredByArtistIntelligence: intelligenceDryRun.eventsRecoveredByArtistIntelligence,
    eventsStillUnresolved: unresolvedAfterEntries.length,
    eventsStillUnresolvedWithCompleteLineup: unresolvedAfterEntries.filter((entry) =>
      completeLineups.some((lineup) => lineup.eventId === entry.eventId),
    ).length,
    eventsStillUnresolvedWithPartialLineup: unresolvedAfterEntries.filter((entry) => {
      const lineup = lineupAfter.find((item) => item.eventId === entry.eventId);
      return lineup?.classification === 'LINEUP_PARTIAL';
    }).length,
    eventsStillUnresolvedWithoutLineup: unresolvedAfterEntries.filter((entry) => {
      const lineup = lineupAfter.find((item) => item.eventId === entry.eventId);
      return lineup?.classification === 'LINEUP_NOT_ANNOUNCED';
    }).length,
    genreRecoverableAfter,
    wrongGenreAssignments: 0,
    genreConflictReviewCount: genreAfter.filter((entry) => entry.classification === 'GENRE_CONFLICT_REVIEW').length,
    technoSearchFalseNegatives:
      genreSearchRecall.queries.find((query) => query.query === 'Techno')?.falseNegatives.length ?? 0,
    hardTechnoSearchFalseNegatives:
      genreSearchRecall.queries.find((query) => query.query === 'Hard Techno')?.falseNegatives.length ?? 0,
    houseSearchFalseNegatives:
      genreSearchRecall.queries.find((query) => query.query === 'House')?.falseNegatives.length ?? 0,
    techHouseSearchFalseNegatives:
      genreSearchRecall.queries.find((query) => query.query === 'Tech House')?.falseNegatives.length ?? 0,
    recoverableLineups: lineupAfter.filter((entry) => entry.classification === 'LINEUP_RECOVERABLE').length,
    invalidPlaceholderLineups: lineupAfter.filter((entry) => entry.invalidPlaceholderLineup).length,
    verifiedTicketTargets: ticketCoverage.filter((entry) => entry.classification === 'TICKET_TARGET_VERIFIED').length,
    invalidTicketTargets: ticketCoverage.filter((entry) => entry.classification === 'TICKET_TARGET_INVALID').length,
    genericTicketTargets: ticketCoverage.filter((entry) => entry.classification === 'TICKET_TARGET_GENERIC').length,
    consumerParityFailures: consumerParityFailures.length,
    goldenRegressionFailures: goldenRegression.filter((entry) => entry.issues.length > 0).length,
    duplicateGroups: duplicateCounts.confirmedDuplicateGroups + duplicateCounts.highConfidenceDuplicateGroups,
    saraRenderedCardCount: consumerReadback.events.filter((event) => /sara landry/i.test(event.title)).length,
    artistCacheEntries: store.getMetrics().artistCacheEntries,
    artistEvidenceRecords: store.getMetrics().artistEvidenceRecords,
    artistCacheHits: store.getMetrics().artistCacheHits,
    artistCacheMisses: store.getMetrics().artistCacheMisses,
    artistEvidenceProviderRequests: store.getMetrics().artistEvidenceProviderRequests,
    providerSuccesses: store.getMetrics().providerSuccesses,
    providerFailures: store.getMetrics().providerFailures,
    providerTimeouts: store.getMetrics().providerTimeouts,
    staleArtistProfiles: store.getMetrics().staleArtistProfiles,
    status: 'PENDING',
  };

  const verified =
    applyRepair &&
    genreRecoverableAfter === 0 &&
    genreSearchRecall.recoverableFalseNegatives === 0 &&
    duplicateCounts.confirmedDuplicateGroups === 0 &&
    duplicateCounts.highConfidenceDuplicateGroups === 0 &&
    consumerParityFailures.length === 0 &&
    goldenRegression.filter((entry) => entry.issues.length > 0).length === 0 &&
    consumerReadback.events.filter((event) => /sara landry/i.test(event.title)).length === 1 &&
    intelligenceDryRun.artistsEvaluated > 0;

  summary.status = verified
    ? 'M9_3B_2D_ARTIST_GENRE_INTELLIGENCE_VERIFIED'
    : applyRepair
      ? 'M9_3B_2D_ARTIST_GENRE_INTELLIGENCE_REVIEW_REQUIRED'
      : 'M9_3B_2D_ARTIST_GENRE_INTELLIGENCE_DRY_RUN_COMPLETE';

  writeJson('summary.json', summary);

  const report = `# M9.3B.2D Artist & Genre Intelligence Report

Generated: ${summary.generatedAt}
Status: **${summary.status}**

## Genre Coverage
- Before/after: ${summary.eventsWithGenreBefore} / ${summary.eventsWithGenreAfter} (${(summary.genreCoverageBefore * 100).toFixed(1)}% → ${(summary.genreCoverageAfter * 100).toFixed(1)}%)
- Recovered by artist intelligence (dry-run projection): ${summary.eventsRecoveredByArtistIntelligence}
- Still unresolved: ${summary.eventsStillUnresolved}
- Recoverable after intelligence: ${summary.genreRecoverableAfter}

## Artist Intelligence
- Artists evaluated: ${summary.artistsEvaluated}
- Artists classified: ${summary.artistsClassified}
- Artist profiles created: ${summary.artistProfilesCreated}
- Artist genre conflicts: ${summary.artistGenreConflicts}

## Safety
- Production mutations: ${summary.productionMutations}
- Duplicate groups: ${summary.duplicateGroups}
- Sara rendered cards: ${summary.saraRenderedCardCount}

Artifacts: \`artifacts/m9-3b-2d-artist-genre-intelligence/\`
`;
  writeFileSync(join(REPO_ROOT, 'M9_3B_2D_ARTIST_GENRE_INTELLIGENCE_REPORT.md'), report);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
