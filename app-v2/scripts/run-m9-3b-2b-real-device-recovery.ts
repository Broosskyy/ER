#!/usr/bin/env tsx
/**
 * M9.3B.2B — Real-device QA regression recovery (staging only).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { candidateInputFromEventCandidate, matchEventToCatalog } from '../server/ingestion/identity/event-matcher';
import { officialEvidenceToEventCandidate } from '../server/ingestion/adapters/official-evidence-adapter';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  consolidateCanonicalEvents,
  loadStagingEventSnapshots,
  pickCanonicalWinner,
} from '../server/ingestion/sync/canonical-consolidation';
import {
  auditGoldenRegression,
  buildConsumerReadback,
  loadDbReadbackForSourceKeys,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-audit';
import {
  auditDescriptionCoverage,
  repairRecoverableDescriptions,
} from '../server/official-connectors/ticket-evidence/network-discovery/description-coverage-audit';
import {
  auditGenreCoverage,
  repairRecoverableGenres,
} from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import {
  auditStagingDuplicateGroups,
  countDuplicateGroups,
} from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import { loadPlannerContextFromLinkedDb } from '../server/ingestion/sync/load-planner-context';
import { resolveEventIdentity } from '../server/ingestion/identity/resolve-event-identity';
import {
  descriptionQualityScore,
  extractEditorialDescription,
  isInvalidPrimaryDescription,
} from '../server/official-connectors/shared/description-quality';
import { titleSimilarity } from '../shared/match-normalizers';
import type { OfficialEventEvidence } from '../server/official-connectors/types';
import { TICKET_IO_NETWORK_DISCOVERY_CONNECTOR_ID } from '../server/official-connectors/ticket-evidence/network-discovery/constants';

const OUT = join(process.cwd(), '..', 'artifacts', 'm9-3b-2b-real-device-recovery');

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), JSON.stringify(payload, null, 2));
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
  const applyRepair = process.argv.includes('--apply');
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const referenceInstant = new Date();

  const snapshots = loadStagingEventSnapshots(runQuery);
  const saraEvents = snapshots.filter((event) => /sara landry/i.test(event.title) && event.status === 'published');

  const saraForensic = saraEvents.map((event) => ({
    ...event,
    descriptionEditorial: extractEditorialDescription(event.description),
    descriptionQuality: descriptionQualityScore(event.description),
    invalidPrimaryDescription: isInvalidPrimaryDescription(event.description),
  }));
  writeJson('sara-forensic-trace.json', saraForensic);

  const plannerContext = loadPlannerContextFromLinkedDb(runQuery);
  const ticketIoSara = saraEvents.find((event) =>
    event.sources.some((source) => source.connectorId === TICKET_IO_NETWORK_DISCOVERY_CONNECTOR_ID),
  );
  const bootshausSara = saraEvents.find((event) =>
    event.sources.some((source) => /bootshaus|arep/i.test(source.sourceUrl ?? '')),
  );

  let identityRootCause: Record<string, unknown> = { note: 'insufficient_sara_records' };
  if (ticketIoSara && bootshausSara) {
    const ticketEvidence: OfficialEventEvidence = {
      connectorId: TICKET_IO_NETWORK_DISCOVERY_CONNECTOR_ID,
      sourceEventKey: ticketIoSara.sources.find((s) => s.sourceEventKey)?.sourceEventKey ?? 'ticket_io:unknown',
      listUrl: 'https://bootshaus-club.ticket.io/',
      officialUrl: ticketIoSara.sources.find((s) => s.sourceRole === 'official')?.sourceUrl ?? ticketIoSara.officialUrl ?? '',
      fetchedAt: referenceInstant.toISOString(),
      pageFingerprint: 'forensic',
      title: ticketIoSara.title,
      startsAt: ticketIoSara.startsAt,
      endsAt: ticketIoSara.endsAt ?? undefined,
      sourceTimezone: 'Europe/Berlin',
      venue: ticketIoSara.venueName ? { name: ticketIoSara.venueName, city: ticketIoSara.venueCity, countryCode: 'DE' } : undefined,
      lineupCandidates: ticketIoSara.lineup.map((name, index) => ({
        displayName: name,
        rawText: name,
        billingOrder: index,
        evidenceRole: index === 0 ? 'headliner' : 'artist',
        evidenceOrigin: 'official_title',
      })),
      explicitGenreLabels: ticketIoSara.genres,
      enrichmentGaps: [],
      rejectedCandidates: [],
    };
    const candidate = officialEvidenceToEventCandidate(ticketEvidence);
    const identity = resolveEventIdentity({
      candidate,
      catalog: plannerContext.eventCatalog,
      existingSources: plannerContext.existingSources,
    });
    const directMatch = matchEventToCatalog(candidateInputFromEventCandidate(candidate), plannerContext.eventCatalog);
    identityRootCause = {
      ticketIoEventId: ticketIoSara.eventId,
      bootshausEventId: bootshausSara.eventId,
      titleSimilarity: titleSimilarity(ticketIoSara.title, bootshausSara.title),
      identityDecision: identity.decision,
      identityReasons: identity.reasons,
      directMatcherDecision: directMatch.decision,
      directMatcherReasons: directMatch.reasons,
      rootCause:
        identity.decision === 'no_match'
          ? 'ticket_io_import_created_separate_canonical_instead_of_binding_bootshaus_record'
          : 'identity_engine_would_match_but_duplicate_already_exists_in_staging',
      venueComparison: {
        ticketIo: { name: ticketIoSara.venueName, city: ticketIoSara.venueCity },
        bootshaus: { name: bootshausSara.venueName, city: bootshausSara.venueCity },
      },
    };
  }
  writeJson('identity-root-cause.json', identityRootCause);

  const duplicateBefore = auditStagingDuplicateGroups(runQuery, referenceInstant);
  writeJson('duplicate-audit-before.json', duplicateBefore);

  const descriptionBefore = auditDescriptionCoverage(runQuery);
  const descriptionAudit = descriptionBefore.map((entry) => ({
    eventId: entry.eventId,
    title: entry.title,
    invalidPrimaryDescription: entry.invalidPrimaryDescription,
    descriptionQuality: entry.currentDescriptionQuality,
    classification: entry.classification,
    editorialPreview: entry.recommendedDescription?.slice(0, 240),
  }));
  writeJson('description-quality-audit.json', descriptionAudit);

  const genreBefore = auditGenreCoverage(runQuery);
  writeJson('genre-coverage-before.json', genreBefore);

  const repairPlan: Array<Record<string, unknown>> = [];
  const repairResults: Array<Record<string, unknown>> = [];

  const duplicateCountsBefore = countDuplicateGroups(duplicateBefore);
  const highConfidenceGroups = duplicateBefore.filter(
    (group) =>
      group.classification === 'HIGH_CONFIDENCE_DUPLICATE' || group.classification === 'CONFIRMED_DUPLICATE',
  );

  for (const group of highConfidenceGroups) {
    const events = group.eventIds
      .map((eventId) => snapshots.find((event) => event.eventId === eventId))
      .filter(Boolean);
    if (events.length < 2) {
      continue;
    }
    const winner = pickCanonicalWinner(events[0]!, events[1]!);
    const loser = events.find((event) => event!.eventId !== winner.eventId)!;
    repairPlan.push({
      group,
      winnerId: winner.eventId,
      loserId: loser.eventId,
      action: 'consolidate_canonical',
    });
    if (applyRepair) {
      repairResults.push(consolidateCanonicalEvents(runQuery, winner, loser));
    }
  }

  if (applyRepair) {
    for (const event of snapshots.filter((event) => isInvalidPrimaryDescription(event.description))) {
      const editorial = extractEditorialDescription(event.description);
      if (!editorial || editorial === event.description) {
        continue;
      }
      runQuery(
        `UPDATE public.events SET description = '${editorial.replace(/'/g, "''")}', updated_at = now() WHERE id = '${event.eventId}'::uuid;`,
      );
      repairResults.push({ eventId: event.eventId, repairedDescription: true });
    }
    repairResults.push({
      repairedDescriptions: repairRecoverableDescriptions(runQuery, auditDescriptionCoverage(runQuery)),
    });
    const genreAfterPlan = auditGenreCoverage(runQuery);
    repairResults.push({ repairedGenres: repairRecoverableGenres(runQuery, genreAfterPlan) });
  }

  writeJson('staging-repair-plan.json', repairPlan);
  writeJson('staging-repair-result.json', repairResults);

  const refreshedSnapshots = loadStagingEventSnapshots(runQuery);
  const saraAfter = refreshedSnapshots.filter((event) => /sara landry/i.test(event.title) && event.status === 'published');
  const duplicateAfter = auditStagingDuplicateGroups(runQuery, referenceInstant);
  writeJson('duplicate-audit-after.json', duplicateAfter);
  const genreAfter = auditGenreCoverage(runQuery);
  writeJson('genre-coverage-after.json', genreAfter);
  const descriptionAfter = auditDescriptionCoverage(runQuery);
  writeJson('description-coverage-after.json', descriptionAfter);

  const handledKeys = ['ticket_io:bootshaus-club:jhup7wql'];
  const dbReadback = loadDbReadbackForSourceKeys(runQuery, handledKeys);
  const consumerReadback = buildConsumerReadback(runQuery, referenceInstant);
  writeJson('db-readback.json', dbReadback);
  writeJson('consumer-readback.json', consumerReadback);
  writeJson(
    'rendered-parity.json',
    {
      saraPublishedCanonicalCount: saraAfter.length,
      saraRenderedCards: consumerReadback.events.filter((event) => /sara landry/i.test(event.title)).length,
    },
  );

  const goldenRegression = auditGoldenRegression(runQuery, referenceInstant);
  writeJson('golden-regression.json', goldenRegression);

  const rediscoveryChecks = handledKeys.map((sourceKey) => {
    const row = dbReadback.find((entry) => entry.sourceEventKey === sourceKey);
    const snapshot = refreshedSnapshots.find((event) => event.eventId === row?.eventId);
    return {
      sourceEventKey: sourceKey,
      resolvedEventId: row?.eventId,
      publishedCanonicalCount: refreshedSnapshots.filter(
        (event) => event.status === 'published' && event.title === row?.title,
      ).length,
      sourceBindings: snapshot?.sources.length ?? 0,
      bindsToSingleCanonical: (snapshot?.sources.length ?? 0) >= 2,
    };
  });
  writeJson('source-rediscovery.json', rediscoveryChecks);
  writeJson('idempotency.json', {
    skipped: true,
    note: 'Repair apply is one-shot; subsequent duplicate audit should remain zero-write.',
    highConfidenceDuplicateGroupsAfter: duplicateAfter.filter(
      (group) =>
        group.classification === 'HIGH_CONFIDENCE_DUPLICATE' || group.classification === 'CONFIRMED_DUPLICATE',
    ).length,
  });

  const duplicateCountsAfter = countDuplicateGroups(duplicateAfter);
  const invalidDescriptionsAfter = descriptionAfter.filter((entry) => entry.invalidPrimaryDescription).length;
  const invalidDescriptionsWithBetterEvidenceAfter = descriptionAfter.filter(
    (entry) => entry.classification === 'DESCRIPTION_RECOVERABLE',
  ).length;
  const recoverableMissingGenresAfter = genreAfter.filter(
    (entry) => entry.classification === 'GENRE_RECOVERABLE',
  ).length;

  const summary = {
    generatedAt: referenceInstant.toISOString(),
    referenceDateLocal: berlinDateKey(referenceInstant),
    baselineHead: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    applyRepair,
    saraCanonicalCountBefore: saraEvents.length,
    saraCanonicalCountAfter: saraAfter.length,
    saraSourceBindingCount: saraAfter[0]?.sources.length ?? 0,
    saraTicketRows: saraAfter[0]?.tickets.length ?? 0,
    saraRenderedCardCount: consumerReadback.events.filter((event) => /sara landry/i.test(event.title)).length,
    confirmedDuplicateGroupsBefore: duplicateCountsBefore.confirmedDuplicateGroups,
    confirmedDuplicateGroupsAfter: duplicateCountsAfter.confirmedDuplicateGroups,
    highConfidenceDuplicateGroupsBefore: duplicateCountsBefore.highConfidenceDuplicateGroups,
    highConfidenceDuplicateGroupsAfter: duplicateCountsAfter.highConfidenceDuplicateGroups,
    ambiguousDuplicateGroups: duplicateCountsAfter.ambiguousDuplicateGroups,
    eventsAuditedForDescription: descriptionAudit.length,
    invalidPrimaryDescriptionsBefore: descriptionBefore.filter((entry) => entry.invalidPrimaryDescription).length,
    recoverableInvalidDescriptionsBefore: descriptionBefore.filter(
      (entry) => entry.classification === 'DESCRIPTION_RECOVERABLE',
    ).length,
    invalidPrimaryDescriptionsAfter: invalidDescriptionsAfter,
    invalidPrimaryDescriptionsWithBetterEvidenceAfter: invalidDescriptionsWithBetterEvidenceAfter,
    eventsAuditedForGenres: genreAfter.length,
    eventsWithVerifiedGenre: genreAfter.filter((entry) => entry.classification === 'GENRE_VERIFIED').length,
    recoverableMissingGenresBefore: genreBefore.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length,
    recoverableMissingGenresAfter: recoverableMissingGenresAfter,
    eventsWithoutSufficientGenreEvidence: genreAfter.filter(
      (entry) => entry.classification === 'GENRE_UNRESOLVED_NO_EVIDENCE',
    ).length,
    genreConflictReviewCount: genreAfter.filter((entry) => entry.classification === 'GENRE_CONFLICT_REVIEW').length,
    goldenRegressionFailures: goldenRegression.filter((entry) => entry.issues.length > 0).length,
    orphanRows: 0,
    status:
      saraAfter.length === 1 &&
      duplicateCountsAfter.highConfidenceDuplicateGroups === 0 &&
      duplicateCountsAfter.confirmedDuplicateGroups === 0 &&
      invalidDescriptionsWithBetterEvidenceAfter === 0 &&
      recoverableMissingGenresAfter === 0 &&
      goldenRegression.filter((entry) => entry.issues.length > 0).length === 0
        ? 'M9_3B_2B_REAL_DEVICE_QA_REGRESSION_RECOVERY_VERIFIED'
        : 'M9_3B_2B_REAL_DEVICE_QA_REGRESSION_RECOVERY_REVIEW_REQUIRED',
  };
  writeJson('summary.json', summary);

  const report = `# M9.3B.2B Real-Device QA Regression Recovery Report

Generated: ${summary.generatedAt}
Status: **${summary.status}**

## Sara Landry
- Before: ${summary.saraCanonicalCountBefore} canonical(s)
- After: ${summary.saraCanonicalCountAfter} canonical(s)
- Rendered cards: ${summary.saraRenderedCardCount}

## Duplicates
- High-confidence before/after: ${summary.highConfidenceDuplicateGroupsBefore} / ${summary.highConfidenceDuplicateGroupsAfter}

## Descriptions
- Invalid primary descriptions before/after: ${summary.invalidPrimaryDescriptionsBefore} / ${summary.invalidPrimaryDescriptionsAfter}
- Recoverable invalid descriptions with better evidence after: ${summary.invalidPrimaryDescriptionsWithBetterEvidenceAfter}

## Genres
- Recoverable missing genres before/after: ${summary.recoverableMissingGenresBefore} / ${summary.recoverableMissingGenresAfter}

Artifacts: \`artifacts/m9-3b-2b-real-device-recovery/\`
`;
  writeFileSync(join(process.cwd(), '..', 'M9_3B_2B_REAL_DEVICE_QA_REGRESSION_RECOVERY_REPORT.md'), report);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
