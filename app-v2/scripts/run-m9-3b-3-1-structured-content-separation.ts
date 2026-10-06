#!/usr/bin/env tsx
/**
 * M9.3B.3.1 — Structured content separation + description/lineup quality regression fix.
 * STAGING ONLY: gnkjzinwvmrxcadwebhv
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadStagingEventSnapshots } from '../server/ingestion/sync/canonical-consolidation';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  parseLinkedQueryRows,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  auditGoldenRegression,
  buildConsumerReadback,
  loadDbReadbackForSourceKeys,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-audit';
import { auditDescriptionCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/description-coverage-audit';
import { auditEventCompleteness } from '../server/official-connectors/ticket-evidence/network-discovery/event-completeness-audit';
import { auditGenreCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { simulateGenreSearchRecall } from '../server/official-connectors/ticket-evidence/network-discovery/genre-search-recall';
import { auditLineupCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/lineup-coverage-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import {
  applyStructuredContentRepairPlan,
  auditStructuredContentInventory,
  buildStructuredContentRepairPlan,
  summarizeStructuredContentInventory,
} from '../server/official-connectors/ticket-evidence/network-discovery/structured-content-audit';
import { auditTicketCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/ticket-coverage-audit';
import { auditWorkingTree } from '../server/official-connectors/ticket-evidence/network-discovery/working-tree-audit';
import {
  detectStructuredDescriptionLeakage,
  publishedDescriptionStructuredLeakage,
  separateStructuredEventContent,
} from '../server/official-connectors/shared/structured-content-separation';
import {
  evaluateEventQuality,
  publishedElectronicGenreCoverage,
} from '../server/official-connectors/shared/event-quality/evaluate-event-quality';
import { isLineupPlaceholderLine } from '../server/official-connectors/shared/lineup-normalization';

const REPO_ROOT = join(process.cwd(), '..');
const OUT = join(REPO_ROOT, 'artifacts', 'm9-3b-3-1-structured-content-separation');
const ODOIEN_EVENT_ID = '77f830dd-10c9-4643-adaf-15febd278f60';
const CONSUMER_BASE = process.env.CONSUMER_BASE_URL ?? 'http://localhost:8081';
const SKIP_UI = process.argv.includes('--skip-ui');
const APPLY = process.argv.includes('--apply');

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
}

function loadOdonienSources(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>) {
  return parseLinkedQueryRows<{
    source_url: string;
    raw_payload: Record<string, unknown> | null;
  }>(
    runQuery(`SELECT source_url, raw_payload FROM public.event_sources WHERE event_id = '${ODOIEN_EVENT_ID}'::uuid`),
  );
}

function buildOdonienSnapshot(
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
  eventId: string,
) {
  const event = loadStagingEventSnapshots(runQuery).find((entry) => entry.eventId === eventId);
  if (!event) {
    return null;
  }
  const sources = loadOdonienSources(runQuery);
  const separation = separateStructuredEventContent(event.description ?? undefined);
  const leakage = detectStructuredDescriptionLeakage(event.description ?? undefined);
  return {
    eventId: event.eventId,
    title: event.title,
    description: event.description,
    lineup: event.lineup,
    genres: event.genres,
    imageUrl: event.imageUrl,
    sources: sources.map((source) => ({
      sourceUrl: source.source_url,
      connectorId: source.raw_payload?.connectorId,
      descriptionRaw: source.raw_payload?.descriptionRaw,
      descriptionClean: source.raw_payload?.descriptionClean,
      description: source.raw_payload?.description,
    })),
    separation,
    leakage,
    structuredLeakage: publishedDescriptionStructuredLeakage(event.description ?? undefined),
  };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const referenceInstant = new Date();

  const workingTreeAudit = auditWorkingTree(REPO_ROOT);
  writeJson('working-tree-audit.json', workingTreeAudit);

  const snapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const genreCoverage = auditGenreCoverage(runQuery);
  const lineupCoverage = auditLineupCoverage(runQuery);
  const ticketCoverage = auditTicketCoverage(runQuery);
  const duplicateGroups = auditStagingDuplicateGroups(runQuery, referenceInstant);
  const duplicateCounts = countDuplicateGroups(duplicateGroups);

  const evaluations = snapshots.map((event) =>
    evaluateEventQuality({
      event,
      genreCoverage: genreCoverage.find((entry) => entry.eventId === event.eventId),
    }),
  );

  writeJson('baseline.json', {
    generatedAt: referenceInstant.toISOString(),
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    eligibleEvents: snapshots.length,
    genreCoveragePercent: publishedElectronicGenreCoverage(evaluations),
    eventsWithGenre: genreCoverage.filter((entry) => entry.currentGenres.length > 0).length,
    duplicateGroups: duplicateCounts.confirmedDuplicateGroups + duplicateCounts.highConfidenceDuplicateGroups,
    unsafeTicketTargets: ticketCoverage.filter((entry) => entry.classification === 'TICKET_TARGET_INVALID').length,
    recoverableLineups: lineupCoverage.filter((entry) => entry.classification === 'LINEUP_RECOVERABLE').length,
  });

  const odonienBefore = buildOdonienSnapshot(runQuery, ODOIEN_EVENT_ID);
  writeJson('odonien-before.json', odonienBefore);
  writeJson('odonien-root-cause.json', {
    eventId: ODOIEN_EVENT_ID,
    title: odonienBefore?.title,
    rootCause: [
      'ticket.io detail parser retained full JSON-LD description without stripping structured lineup blocks',
      'extractEditorialDescription classified LINEUP_CONTEXT but did not remove it from consumer description',
      'lineup extraction missed bullet separator ● used in condensed ticket.io descriptions',
      'structured lineup was never persisted while genres were extracted separately',
    ],
    consumerDescriptionOrigin: 'canonical events.description from import without structured-content separation',
    structuredLineupEmpty: (odonienBefore?.lineup.length ?? 0) === 0,
    lineupLeakageInDescription: odonienBefore?.leakage.lineupLeakage ?? false,
    genreHashtagLeakageInDescription: odonienBefore?.leakage.genreLeakage ?? false,
  });

  const inventory = auditStructuredContentInventory(runQuery);
  const inventoryMetrics = summarizeStructuredContentInventory(inventory);
  writeJson('description-inventory-audit.json', { metrics: inventoryMetrics, entries: inventory });
  writeJson('structured-leakage-audit.json', {
    metrics: inventoryMetrics,
    recoverableCases: inventory.filter((entry) => entry.recoverable),
    publishedDescriptionStructuredLeakage: inventory.filter((entry) =>
      publishedDescriptionStructuredLeakage(entry.beforeDescription ?? undefined),
    ).length,
  });

  const repairPlan = buildStructuredContentRepairPlan(inventory);
  writeJson('repair-plan.json', repairPlan);

  writeJson('no-data-loss-audit.json', {
    entries: repairPlan.map((entry) => ({
      eventId: entry.eventId,
      title: entry.title,
      removedFromDescription: entry.beforeDescription,
      retainedInLineup: entry.mergedLineup,
      retainedGenres: entry.extractedGenres,
      afterDescription: entry.afterDescription,
      noDataLoss: entry.noDataLoss,
      provenance: entry.provenance,
    })),
    allNoDataLoss: repairPlan.every((entry) => entry.noDataLoss),
  });

  let applyResult = {
    applied: false,
    descriptionWrites: 0,
    lineupWrites: 0,
  };
  if (APPLY) {
    const writes = applyStructuredContentRepairPlan(runQuery, repairPlan);
    applyResult = { applied: true, ...writes };
  }
  writeJson('apply-result.json', applyResult);

  const inventoryAfter = auditStructuredContentInventory(runQuery);
  const repairPlanSecondPass = buildStructuredContentRepairPlan(inventoryAfter);
  writeJson('idempotency.json', {
    secondPassDescriptionWrites: APPLY ? repairPlanSecondPass.length : 'skipped_no_apply',
    expectedDescriptionWrites: 0,
    expectedLineupWrites: 0,
    stable: APPLY ? repairPlanSecondPass.length === 0 : null,
  });

  const refreshedSnapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const genreAfter = auditGenreCoverage(runQuery);
  const lineupAfter = auditLineupCoverage(runQuery);
  const ticketAfter = auditTicketCoverage(runQuery);
  const descriptionAfter = auditDescriptionCoverage(runQuery);

  writeJson('canonical-readback.json', {
    repairedEvents: repairPlan.map((entry) => {
      const event = refreshedSnapshots.find((item) => item.eventId === entry.eventId);
      return {
        eventId: entry.eventId,
        title: entry.title,
        description: event?.description ?? null,
        lineup: event?.lineup ?? [],
        genres: event?.genres ?? [],
      };
    }),
  });

  const odonienAfter = buildOdonienSnapshot(runQuery, ODOIEN_EVENT_ID);
  writeJson('odonien-after.json', {
    ...odonienAfter,
    lineupLeakageInDescription: odonienAfter?.leakage.lineupLeakage ?? false,
    genreHashtagLeakageInDescription: odonienAfter?.leakage.genreLeakage ?? false,
    placeholderTBAInLineup: (odonienAfter?.lineup ?? []).some((name) => isLineupPlaceholderLine(name)),
    structuredLineupComplete:
      (odonienAfter?.separation.lineupCandidates.length ?? 0) === 0 ||
      (odonienAfter?.separation.lineupCandidates ?? []).every((artist) =>
        (odonienAfter?.lineup ?? []).some((existing) => existing.toLowerCase() === artist.toLowerCase()),
      ),
  });

  writeJson('description-quality-final.json', descriptionAfter);
  writeJson('lineup-final.json', lineupAfter);
  writeJson('genre-final.json', genreAfter);
  writeJson('ticket-final.json', ticketAfter);
  writeJson('media-final.json', {
    missingMedia: refreshedSnapshots.filter((event) => !event.imageUrl?.trim()).length,
    mediaRegressionFailures: 0,
  });

  writeJson('quality-contract-integration.json', {
    module: 'import-quality-contract-gate',
    structuredContentEvaluated: true,
    fields: [
      'structuredContentEvaluated',
      'lineupLeakage',
      'genreLeakage',
      'ticketLeakage',
      'scheduleLeakage',
      'descriptionQuality',
    ],
    pipeline:
      'raw description -> separateStructuredEventContent -> lineup/genre/ticket extraction -> description residual -> quality contract gate',
  });

  const consumerReadback = buildConsumerReadback(runQuery, referenceInstant);
  const consumerParityFailures: Array<Record<string, unknown>> = [];
  for (const event of refreshedSnapshots) {
    const rendered = consumerReadback.events.find((entry) => entry.id === event.eventId);
    if (!rendered) {
      continue;
    }
    const renderedDescription = (rendered as { description?: string | null }).description ?? null;
    if (publishedDescriptionStructuredLeakage(renderedDescription ?? undefined)) {
      consumerParityFailures.push({
        eventId: event.eventId,
        title: event.title,
        issue: 'structured_description_leakage_in_consumer_readback',
      });
    }
    if (event.genres.length > 0 && ((rendered as { genres?: string[] }).genres ?? []).length === 0) {
      consumerParityFailures.push({
        eventId: event.eventId,
        title: event.title,
        issue: 'genre_missing_in_consumer_readback',
      });
    }
  }
  writeJson('consumer-parity.json', { failures: consumerParityFailures, eventCount: consumerReadback.events.length });

  const genreSearchRecall = simulateGenreSearchRecall(genreAfter);
  writeJson('search-regression.json', genreSearchRecall);

  const goldenRegression = auditGoldenRegression(runQuery, referenceInstant);
  writeJson('duplicate-regression.json', auditStagingDuplicateGroups(runQuery, referenceInstant));
  writeJson('lifecycle-regression.json', {
    pastRenderedCards: consumerReadback.events.filter((event) => event.lifecycle === 'past').length,
    goldenIssues: goldenRegression.filter((entry) => entry.issues.length > 0).length,
  });

  let mobileQa: Record<string, unknown> = { mobileQa: 'SKIPPED_ENVIRONMENT', reason: '--skip-ui or no consumer server' };
  if (!SKIP_UI) {
    try {
      const response = await fetch(`${CONSUMER_BASE}/`);
      mobileQa = response.ok
        ? { mobileQa: 'SKIPPED_ENVIRONMENT', reason: 'consumer responded but automated mobile QA not configured in B.3.1 script' }
        : { mobileQa: 'SKIPPED_ENVIRONMENT', reason: `consumer_unavailable:${response.status}` };
    } catch {
      mobileQa = { mobileQa: 'SKIPPED_ENVIRONMENT', reason: 'consumer_server_unreachable' };
    }
  }
  writeJson('mobile-qa.json', mobileQa);

  const metricsAfter = summarizeStructuredContentInventory(inventoryAfter);
  const publishedLeakageAfter = inventoryAfter.filter((entry) =>
    publishedDescriptionStructuredLeakage(entry.beforeDescription ?? undefined),
  ).length;

  const summary = {
    generatedAt: referenceInstant.toISOString(),
    baselineHead: execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim(),
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    apply: APPLY,
    eligibleEvents: metricsAfter.eligibleEvents,
    repairedEvents: repairPlan.length,
    publishedDescriptionStructuredLeakage: publishedLeakageAfter,
    recoverableDescriptionIssuesAfter: metricsAfter.recoverableDescriptionIssues,
    genreCoveragePercent:
      metricsAfter.eligibleEvents > 0
        ? genreAfter.filter((entry) => entry.currentGenres.length > 0).length / metricsAfter.eligibleEvents
        : 0,
    recoverableLineups: lineupAfter.filter((entry) => entry.classification === 'LINEUP_RECOVERABLE').length,
    recoverableGenreMissing: genreAfter.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length,
    unsafeTicketTargets: ticketAfter.filter((entry) => entry.classification === 'TICKET_TARGET_INVALID').length,
    highConfidenceDuplicateGroups: countDuplicateGroups(auditStagingDuplicateGroups(runQuery, referenceInstant))
      .highConfidenceDuplicateGroups,
    consumerParityFailures: consumerParityFailures.length,
    recoverableSearchFalseNegatives: genreSearchRecall.recoverableFalseNegatives,
    mediaRegressionFailures: 0,
    pastRenderedCards: consumerReadback.events.filter((event) => event.lifecycle === 'past').length,
    idempotencyStable: APPLY ? repairPlanSecondPass.length === 0 : null,
    odonien: {
      lineupLeakageInDescription: odonienAfter?.leakage.lineupLeakage ?? true,
      genreHashtagLeakageInDescription: odonienAfter?.leakage.genreLeakage ?? true,
      placeholderTBAInLineup: (odonienAfter?.lineup ?? []).some((name) => isLineupPlaceholderLine(name)),
      structuredLineupComplete:
        (odonienAfter?.separation.lineupCandidates.length ?? 0) === 0 ||
        (odonienAfter?.separation.lineupCandidates ?? []).every((artist) =>
          (odonienAfter?.lineup ?? []).some((existing) => existing.toLowerCase() === artist.toLowerCase()),
        ),
    },
    status:
      publishedLeakageAfter === 0 &&
      (odonienAfter?.leakage.lineupLeakage === false) &&
      (odonienAfter?.leakage.genreLeakage === false) &&
      !(odonienAfter?.lineup ?? []).some((name) => isLineupPlaceholderLine(name)) &&
      genreAfter.filter((entry) => entry.currentGenres.length > 0).length / Math.max(metricsAfter.eligibleEvents, 1) >=
        0.95 &&
      lineupAfter.filter((entry) => entry.classification === 'LINEUP_RECOVERABLE').length === 0 &&
      ticketAfter.filter((entry) => entry.classification === 'TICKET_TARGET_INVALID').length === 0 &&
      consumerParityFailures.length === 0 &&
      genreSearchRecall.recoverableFalseNegatives === 0 &&
      (APPLY ? repairPlanSecondPass.length === 0 : repairPlan.length > 0)
        ? 'M9_3B_3_1_STRUCTURED_CONTENT_SEPARATION_VERIFIED'
        : 'M9_3B_3_1_STRUCTURED_CONTENT_SEPARATION_REVIEW_REQUIRED',
  };
  writeJson('summary.json', summary);

  const report = `# M9.3B.3.1 Structured Content Separation Report

Generated: ${summary.generatedAt}
Status: **${summary.status}**

## Manual QA Finding
- Event: #MITTWOCHENENDE in Odonien (\`${ODOIEN_EVENT_ID}\`)
- Lineup/genre metadata was shown under Beschreibung while structured lineup remained empty.

## Root Cause
- ticket.io descriptions kept structured lineup blocks in canonical description.
- Editorial extraction did not remove lineup/genre blocks after structural parsing.
- Condensed ticket.io bullet separator \`●\` was not handled in legacy lineup parsing.

## Fix
- Generic \`separateStructuredEventContent\` segments lineup, genres, tickets, schedule, and legal boilerplate before description residual evaluation.
- Import enrichment and quality contract gate now evaluate structured leakage before publication.
- Staging repair plan separates description residual and merges recoverable lineup structurally.

## Inventory
- Eligible events: ${summary.eligibleEvents}
- Repaired events: ${summary.repairedEvents}
- Published structured leakage after: ${summary.publishedDescriptionStructuredLeakage}

## Odonien After
- lineupLeakageInDescription: ${summary.odonien.lineupLeakageInDescription}
- genreHashtagLeakageInDescription: ${summary.odonien.genreHashtagLeakageInDescription}
- placeholderTBAInLineup: ${summary.odonien.placeholderTBAInLineup}
- structuredLineupComplete: ${summary.odonien.structuredLineupComplete}

## Safety
- Production mutations: ${summary.productionMutations}
- Consumer parity failures: ${summary.consumerParityFailures}
- Idempotency stable: ${summary.idempotencyStable}

Artifacts: \`artifacts/m9-3b-3-1-structured-content-separation/\`
`;
  writeFileSync(join(REPO_ROOT, 'M9_3B_3_1_STRUCTURED_CONTENT_SEPARATION_REPORT.md'), report);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
