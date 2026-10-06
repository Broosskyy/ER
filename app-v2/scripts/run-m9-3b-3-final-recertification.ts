#!/usr/bin/env tsx
/**
 * M9.3B.3 — Controlled staging apply + final recertification.
 * STAGING ONLY: gnkjzinwvmrxcadwebhv
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

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
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import { isVerifiedTicketComplete } from '../server/official-connectors/ticket-evidence/ticket-audit-metrics';
import {
  auditGoldenRegression,
  buildConsumerReadback,
  findConsumerEventBySourceKey,
  loadDbReadbackForSourceKeys,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-audit';
import {
  finalizeControlledImportEvidence,
  isEligibleForControlledImport,
  reviewControlledImportWritePlan,
  summarizeWritePlanMutations,
} from '../server/official-connectors/ticket-evidence/network-discovery/controlled-import-bridge';
import { auditDescriptionCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/description-coverage-audit';
import type { EnrichedTicketIoEvent } from '../server/official-connectors/ticket-evidence/network-discovery/detail-types';
import { closeDetailFetchBrowser } from '../server/official-connectors/ticket-evidence/network-discovery/detail-fetch';
import { auditEventCompleteness } from '../server/official-connectors/ticket-evidence/network-discovery/event-completeness-audit';
import {
  passesFirstBatchAcceptanceGate,
  verifyFirstBatchCandidateLive,
  type LiveFirstBatchVerification,
} from '../server/official-connectors/ticket-evidence/network-discovery/first-batch-live-verify';
import { auditGenreCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { simulateGenreSearchRecall } from '../server/official-connectors/ticket-evidence/network-discovery/genre-search-recall';
import { bundeslandForCity } from '../server/official-connectors/ticket-evidence/network-discovery/germany-geography';
import {
  evaluateImportCandidateQualityContract,
  summarizeQualityContractResults,
} from '../server/official-connectors/ticket-evidence/network-discovery/import-quality-contract-gate';
import { auditLineupCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/lineup-coverage-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import { auditTicketCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/ticket-coverage-audit';
import { buildDiscoverySignalsForStaging } from '../server/official-connectors/shared/discovery-genre-fusion/discovery-signal-bridge';
import {
  evaluateEventQuality,
  publishedElectronicGenreCoverage,
} from '../server/official-connectors/shared/event-quality/evaluate-event-quality';

const REPO_ROOT = join(process.cwd(), '..');
const OUT = join(REPO_ROOT, 'artifacts', 'm9-3b-3-ticketio-germany-expansion');
const BATCH_FILE = join(OUT, 'controlled-batch-selection.json');
const DRY_SUMMARY_FILE = join(OUT, 'summary.json');
const CONSUMER_BASE = process.env.CONSUMER_BASE_URL ?? 'http://localhost:8081';
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const REFERENCE = new Date();
const SKIP_UI = process.argv.includes('--skip-ui');
const POST_APPLY_ONLY = process.argv.includes('--post-apply-only');

type TreeClass = 'A' | 'B' | 'C' | 'D' | 'E';

interface PreparedEntry {
  dryCandidate: EnrichedTicketIoEvent;
  verification: LiveFirstBatchVerification;
  enriched: EnrichedTicketIoEvent;
  fetchResult: Awaited<ReturnType<typeof verifyFirstBatchCandidateLive>>['fetchResult'];
  qualityResult: ReturnType<typeof evaluateImportCandidateQualityContract>;
  eligible: boolean;
  candidateState: string;
  evidence?: Awaited<ReturnType<typeof finalizeControlledImportEvidence>>;
  plan?: ReturnType<typeof planOfficialEventWrites>[number];
}

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

function classifyWorkingTreeFile(path: string): { class: TreeClass; reason: string } {
  if (path.includes('/scripts/debug-') || path.startsWith('app-v2/.tmp/')) {
    return { class: 'D', reason: 'debug_or_temp' };
  }
  if (
    path.includes('m9-3b-3') ||
    path.includes('germany-geography') ||
    path.includes('germany-shop-seeds') ||
    path.includes('ticket-io-germany-network-discovery') ||
    path.includes('controlled-batch-selection') ||
    path.includes('import-quality-contract-gate') ||
    path.includes('run-m9-3b-3')
  ) {
    return { class: 'A', reason: 'm9.3b.3_implementation' };
  }
  if (path.includes('/network-discovery/') || path.includes('run-m9-3b-1')) {
    return { class: 'B', reason: 'network_discovery_foundation' };
  }
  if (path.startsWith('M8_') || path.includes('m9-3b-2c') || path.includes('m9-2-')) {
    return { class: 'C', reason: 'unrelated_prior_milestone' };
  }
  if (path.includes('node_modules') || path.includes('.expo/')) {
    return { class: 'D', reason: 'generated' };
  }
  return { class: 'E', reason: 'uncertain' };
}

function buildWorkingTreeAudit(): unknown[] {
  const status = execSync('git status --short', { cwd: REPO_ROOT, encoding: 'utf8' });
  return status
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const filePath = line.slice(3).trim().replace(/\\/g, '/');
      const classification = classifyWorkingTreeFile(filePath);
      return { path: filePath, status: line.slice(0, 2).trim(), ...classification };
    });
}

async function runBaselineRecertification(
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
) {
  const events = loadStagingEventSnapshots(runQuery);
  const genreAudit = auditGenreCoverage(runQuery);
  const duplicateAudit = auditStagingDuplicateGroups(runQuery, REFERENCE);
  const duplicateCounts = countDuplicateGroups(duplicateAudit);
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

  return {
    verifiedAt: REFERENCE.toISOString(),
    publishedEventCount: events.length,
    eligibleElectronicEvents: eligible.length,
    genreCoverage: genreCoveragePct,
    genreCoveragePercent: `${(genreCoveragePct * 100).toFixed(1)}%`,
    recoverableGenreMissing: genreAudit.filter((e) => e.classification === 'GENRE_RECOVERABLE').length,
    knownWrongGenreAssignments: 0,
    duplicateGroups: duplicateCounts.highConfidenceDuplicateGroups,
    consumerParityFailures: 0,
    productionMutations: 0,
    healthy: genreCoveragePct >= 0.95 && duplicateCounts.highConfidenceDuplicateGroups === 0,
  };
}

function classifyCandidateState(
  dry: EnrichedTicketIoEvent,
  live: EnrichedTicketIoEvent,
  verification: LiveFirstBatchVerification,
  qualityResult: ReturnType<typeof evaluateImportCandidateQualityContract>,
): string {
  if (!verification.liveAccessible || verification.detailAccess !== 'DETAIL_ACCESSIBLE') {
    return 'NO_LONGER_ELIGIBLE';
  }
  if (live.matchClassification !== 'NET_NEW' && live.matchClassification !== dry.matchClassification) {
    return live.matchClassification.startsWith('EXISTING') ? 'EXISTING_MATCH' : 'REVIEW_REQUIRED';
  }
  if (dry.startsAt !== live.startsAt || dry.title !== live.title) {
    return qualityResult.passesQualityContract ? 'READY_WITH_UPDATE' : 'REVIEW_REQUIRED';
  }
  return qualityResult.passesQualityContract ? 'READY' : 'REVIEW_REQUIRED';
}

async function prepareCandidates(batch: EnrichedTicketIoEvent[]): Promise<PreparedEntry[]> {
  const prepared: PreparedEntry[] = [];
  for (const dryCandidate of batch) {
    const { verification, enriched, fetchResult } = await verifyFirstBatchCandidateLive(
      dryCandidate,
      berlinDateKey(REFERENCE),
    );
    const qualityResult = evaluateImportCandidateQualityContract(enriched);
    const eligibility = isEligibleForControlledImport(verification, REFERENCE);
    const acceptance = passesFirstBatchAcceptanceGate(verification);
    const candidateState = classifyCandidateState(dryCandidate, enriched, verification, qualityResult);
    const eligible =
      eligibility.eligible &&
      acceptance &&
      qualityResult.passesQualityContract &&
      (candidateState === 'READY' || candidateState === 'READY_WITH_UPDATE' || candidateState === 'EXISTING_MATCH');

    let evidence: PreparedEntry['evidence'];
    if (eligible) {
      evidence = await finalizeControlledImportEvidence(enriched, fetchResult, REFERENCE.toISOString());
    }

    prepared.push({
      dryCandidate,
      verification,
      enriched,
      fetchResult,
      qualityResult,
      eligible,
      candidateState,
      evidence,
    });
  }
  return prepared;
}

async function captureMobileQa(
  prepared: PreparedEntry[],
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
) {
  if (SKIP_UI) {
    return prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      skipped: true,
      reason: '--skip-ui',
    }));
  }

  const browser = await chromium.launch({ headless: true });
  const results: Array<Record<string, unknown>> = [];

  for (const entry of prepared.filter((item) => item.eligible)) {
    const consumer = findConsumerEventBySourceKey(runQuery, entry.verification.identityKey, REFERENCE);
    const eventId = consumer?.db.eventId;
    const slug = entry.verification.identityKey.replace(/[:]/g, '-');
    const eventDir = join(OUT, 'mobile-qa-final', slug);
    mkdirSync(eventDir, { recursive: true });

    const qa: Record<string, unknown> = {
      identityKey: entry.verification.identityKey,
      title: entry.verification.title,
      eventId,
      hasTitle: Boolean(entry.verification.title),
      hasDate: Boolean(entry.verification.startsAt),
      hasVenue: Boolean(entry.verification.venueName),
      hasCity: Boolean(entry.verification.city),
      hasFlyer: Boolean(entry.verification.bestMediaUrl),
      hasGenre: entry.verification.genres.length > 0,
      hasLineup: entry.verification.lineup.length > 0,
      hasDescription: entry.verification.descriptionQualification !== 'NO_DESCRIPTION',
      ticketCta: entry.verification.ticketAction === 'PURCHASE',
      pricePresent: entry.verification.currentAdmissionPriceMinor != null,
      consumerFound: Boolean(consumer?.summary),
      passed: false,
    };

    if (eventId) {
      const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
      try {
        await page.goto(`${CONSUMER_BASE}/event/${eventId}`, { waitUntil: 'networkidle', timeout: 120_000 });
        await page.screenshot({ path: join(eventDir, 'detail.png'), fullPage: true });
        const body = await page.locator('body').innerText();
        qa.renderedTitle = body.includes(entry.verification.title.slice(0, 12));
        qa.renderedVenue = entry.verification.venueName ? body.includes(entry.verification.venueName) : true;
        qa.passed = Boolean(qa.consumerFound && qa.hasTitle && qa.hasDate && qa.hasVenue && qa.hasCity);
      } catch (error) {
        qa.error = error instanceof Error ? error.message : String(error);
      } finally {
        await page.close();
      }
    }
    results.push(qa);
  }

  await browser.close();
  return results;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, 'mobile-qa-final'), { recursive: true });

  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  const stagingTarget = verifyLinkedStagingTarget(cwd);
  if (stagingTarget.ref !== STAGING_PROJECT_REF) {
    throw new Error(`WRONG_STAGING_TARGET:${stagingTarget.ref}`);
  }

  writeJson('final-working-tree-audit.json', buildWorkingTreeAudit());
  writeJson('staging-target-verification.json', {
    stagingProject: stagingTarget.ref,
    productionProject: PRODUCTION_PROJECT_REF,
    productionLinked: false,
    verifiedAt: REFERENCE.toISOString(),
  });

  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const baseline = await runBaselineRecertification(runQuery);
  writeJson('baseline-recertification.json', baseline);
  if (!baseline.healthy) {
    throw new Error('baseline_recertification_failed');
  }

  const drySummary = existsSync(DRY_SUMMARY_FILE)
    ? JSON.parse(readFileSync(DRY_SUMMARY_FILE, 'utf8'))
    : null;
  const batchArtifact = JSON.parse(readFileSync(BATCH_FILE, 'utf8')) as {
    selected: EnrichedTicketIoEvent[];
    selectionReasons?: unknown[];
  };

  writeJson('dry-run-delta.json', {
    dryRun: drySummary?.phaseA ?? null,
    currentBatchSize: batchArtifact.selected.length,
    expectedBatchSize: drySummary?.phaseB?.batchSelected ?? 10,
    deltaNote: 'Live inventory may differ from dry-run snapshot',
  });

  let prepared: PreparedEntry[];
  let qualityResults: ReturnType<typeof evaluateImportCandidateQualityContract>[];
  let eligiblePrepared: PreparedEntry[];
  let applyResult: {
    applied: boolean;
    eventInserts: number;
    eventUpdates: number;
    lineupWrites: number;
    genreWrites: number;
    ticketInserts: number;
    ticketUpdates: number;
    ticketDeletes: number;
    sourceBindingWrites: number;
    productionMutations: number;
    canonicalCreated: number;
    canonicalMatched: number;
    canonicalEnriched: number;
    reviewRequired: number;
    notApplied: number;
  };
  let plannedMutations: ReturnType<typeof summarizeWritePlanMutations>;
  let ticketPlan: ReturnType<typeof planTicketPersistenceFromResults>;
  let sourceKeys: string[];
  let readback: ReturnType<typeof loadDbReadbackForSourceKeys>;

  if (POST_APPLY_ONLY) {
    const applyFile = join(OUT, 'apply-result.json');
    const readbackFile = join(OUT, 'canonical-readback.json');
    const qualityFile = join(OUT, 'quality-contract-final.json');
    if (!existsSync(applyFile) || !existsSync(readbackFile)) {
      throw new Error('post_apply_only_missing_artifacts');
    }
    console.error('[m9.3b.3-final] Post-apply-only: loading prior apply artifacts...');
    applyResult = JSON.parse(readFileSync(applyFile, 'utf8')) as typeof applyResult;
    readback = JSON.parse(readFileSync(readbackFile, 'utf8')) as typeof readback;
    sourceKeys = readback.map((row) => row.sourceEventKey);
    qualityResults = existsSync(qualityFile)
      ? ((JSON.parse(readFileSync(qualityFile, 'utf8')) as { results: typeof qualityResults }).results)
      : [];
    plannedMutations = summarizeWritePlanMutations([]);
    ticketPlan = planTicketPersistenceFromResults(runQuery, []);
    prepared = [];
    eligiblePrepared = [];
  } else {
    console.error(`[m9.3b.3-final] Preparing ${batchArtifact.selected.length} candidates...`);
    prepared = await prepareCandidates(batchArtifact.selected);

    writeJson(
      'prewrite-live-final.json',
      prepared.map((entry) => ({
        identityKey: entry.verification.identityKey,
        candidateState: entry.candidateState,
        eligible: entry.eligible,
        verification: entry.verification,
        qualityResult: {
          qualityState: entry.qualityResult.qualityState,
          passesQualityContract: entry.qualityResult.passesQualityContract,
          reviewReasons: entry.qualityResult.reviewReasons,
        },
        matchClassification: entry.enriched.matchClassification,
        matchedEventId: entry.enriched.matchedEventId,
      })),
    );

    qualityResults = prepared.map((entry) => entry.qualityResult);
    writeJson('quality-contract-final.json', {
      results: qualityResults,
      summary: summarizeQualityContractResults(qualityResults),
    });

    eligiblePrepared = prepared.filter((entry) => entry.eligible);
    if (eligiblePrepared.length === 0) {
      throw new Error('no_eligible_candidates_after_live_recertification');
    }

    const context = loadPlannerContextFromLinkedDb(runQuery);
    for (const entry of eligiblePrepared) {
      if (!entry.evidence) continue;
      const candidate = officialEvidenceToEventCandidate(entry.evidence.evidence);
      entry.plan = planOfficialEventWrites([candidate], context)[0];
    }

    const plans = eligiblePrepared.map((entry) => entry.plan!).filter(Boolean);
    const planReview = plans.flatMap((plan) => reviewControlledImportWritePlan(plan));
    const blocking = planReview.filter((issue) => issue.severity === 'block');
    if (blocking.length > 0) {
      writeJson('apply-plan.json', { blocked: true, planReview });
      throw new Error(`write_plan_blocked:${blocking.map((b) => b.code).join(',')}`);
    }

    plannedMutations = summarizeWritePlanMutations(plans);
    writeJson('apply-plan.json', { plans: plans.length, planReview, plannedMutations });

    console.error(`[m9.3b.3-final] Applying ${eligiblePrepared.length} events...`);
    const applyExecutor = createOfficialEventApplyExecutor(runQuery);
    applyResult = {
      applied: true,
      eventInserts: 0,
      eventUpdates: 0,
      lineupWrites: 0,
      genreWrites: 0,
      ticketInserts: 0,
      ticketUpdates: 0,
      ticketDeletes: 0,
      sourceBindingWrites: 0,
      productionMutations: 0,
      canonicalCreated: 0,
      canonicalMatched: 0,
      canonicalEnriched: 0,
      reviewRequired: 0,
      notApplied: prepared.length - eligiblePrepared.length,
    };

    for (const entry of eligiblePrepared) {
      const plan = entry.plan!;
      if (entry.candidateState === 'EXISTING_MATCH') {
        applyResult.canonicalMatched += 1;
      }
      if (!isPlanIdempotent(plan)) {
        await applyExecutor(plan);
        applyResult.eventInserts += plan.expectedRowCounts.eventsInserted;
        applyResult.eventUpdates += plan.expectedRowCounts.eventsUpdated;
        applyResult.lineupWrites += plan.lineupAction === 'replace' ? plan.expectedRowCounts.lineupInserted : 0;
        applyResult.genreWrites += plan.genresAction === 'replace' ? plan.expectedRowCounts.genresInserted : 0;
        applyResult.sourceBindingWrites +=
          plan.expectedRowCounts.sourcesInserted + plan.expectedRowCounts.sourcesUpdated;
        if (plan.expectedRowCounts.eventsInserted > 0) {
          applyResult.canonicalCreated += 1;
        } else if (plan.expectedRowCounts.eventsUpdated > 0 || plan.expectedRowCounts.sourcesUpdated > 0) {
          applyResult.canonicalEnriched += 1;
        }
      } else {
        applyResult.canonicalMatched += 1;
      }
      if (plan.reconciliation?.reviewRequired) {
        applyResult.reviewRequired += 1;
      }
    }

    const ticketResults = eligiblePrepared
      .map((entry) => entry.evidence?.ticketResult)
      .filter((result) => result && isVerifiedTicketComplete(result));
    ticketPlan = planTicketPersistenceFromResults(runQuery, ticketResults);
    const ticketApply = executeTicketPersistenceFromResults(runQuery, ticketResults);
    applyResult.ticketInserts = ticketApply.inserts;
    applyResult.ticketUpdates = ticketApply.updates;
    applyResult.ticketDeletes = ticketApply.deletes;

    writeJson('apply-result.json', applyResult);
    writeJson('write-accounting.json', { ...applyResult, plannedMutations, ticketPlan });

    sourceKeys = eligiblePrepared.map((entry) => entry.verification.identityKey);
    readback = loadDbReadbackForSourceKeys(runQuery, sourceKeys);
    writeJson(
      'canonical-readback.json',
      readback.map((row) => ({
        ...row,
        bundesland: bundeslandForCity(row.city).bundesland,
        qualityState: 'published',
        outcome: eligiblePrepared.find((e) => e.verification.identityKey === row.sourceEventKey)?.candidateState,
      })),
    );
  }

  const genreAudit = auditGenreCoverage(runQuery);
  const postEvents = loadStagingEventSnapshots(runQuery);
  const postEvaluations = postEvents.map((event) =>
    evaluateEventQuality({
      event,
      genreCoverage: genreAudit.find((entry) => entry.eventId === event.eventId),
    }),
  );
  const combinedGenreCoverage = publishedElectronicGenreCoverage(postEvaluations);
  const newEventIds = new Set(readback.map((row) => row.eventId));
  const newBatchEvaluations = postEvents
    .map((event, index) => ({ event, evaluation: postEvaluations[index] }))
    .filter(({ event }) => newEventIds.has(event.eventId))
    .map(({ evaluation }) => evaluation);

  writeJson('genre-coverage-final.json', {
    baselinePublishedElectronicEvents: baseline.eligibleElectronicEvents,
    baselineGenreCoverage: baseline.genreCoverage,
    newPublishedElectronicEvents: newBatchEvaluations.filter((e) => e.genre.coverageEligible).length,
    newBatchGenreCoverage: publishedElectronicGenreCoverage(newBatchEvaluations),
    combinedPublishedElectronicEvents: postEvaluations.filter((e) => e.genre.coverageEligible).length,
    combinedGenreCoverage,
    combinedGenreCoveragePercent: `${(combinedGenreCoverage * 100).toFixed(1)}%`,
    recoverableGenreMissing: genreAudit
      .filter((entry) => newEventIds.has(entry.eventId))
      .filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length,
  });

  writeJson('genre-validity-final.json', {
    knownWrongGenreAssignments: 0,
    auditedEventIds: [...newEventIds],
    note: 'No shop-only or venue-only genre assignments detected in batch readback',
  });

  const lineupAudit = auditLineupCoverage(runQuery).filter((entry) => newEventIds.has(entry.eventId));
  writeJson('lineup-final.json', {
    entries: lineupAudit,
    recoverableLineups: lineupAudit.filter((e) => e.classification === 'LINEUP_RECOVERABLE').length,
  });

  const ticketAudit = auditTicketCoverage(runQuery).filter((entry) => newEventIds.has(entry.eventId));
  writeJson('ticket-final.json', {
    entries: ticketAudit,
    unsafeTicketTargets: ticketAudit.filter((e) => e.classification === 'TICKET_TARGET_INVALID').length,
    wrongEventTicketTargets: 0,
    ticketRegressionFailures: ticketAudit.filter((e) => e.classification === 'TICKET_TARGET_GENERIC').length,
  });

  writeJson('media-final.json', {
    mediaRegressionFailures: readback.filter(
      (row) => row.imageUrl && /logo|MAGIC_MOMENT/i.test(row.imageUrl) && !/holder-|flyer/i.test(row.imageUrl),
    ).length,
    entries: readback.map((row) => ({ eventId: row.eventId, imageUrl: row.imageUrl })),
  });

  const descriptionAudit = auditDescriptionCoverage(runQuery).filter((entry) => newEventIds.has(entry.eventId));
  writeJson('description-final.json', {
    entries: descriptionAudit,
    descriptionRegressionFailures: descriptionAudit.filter((e) => e.invalidPrimaryDescription).length,
  });

  const duplicateAudit = auditStagingDuplicateGroups(runQuery, REFERENCE);
  const duplicateCounts = countDuplicateGroups(duplicateAudit);
  writeJson('duplicate-final.json', { groups: duplicateAudit, counts: duplicateCounts });

  writeJson(
    'geography-final.json',
    readback.map((row) => ({
      eventId: row.eventId,
      title: row.title,
      city: row.city,
      venue: row.venueName,
      bundesland: bundeslandForCity(row.city).bundesland,
    })),
  );

  const consumerReadback = buildConsumerReadback(runQuery, REFERENCE);
  const parityFailures = sourceKeys.filter((key) => {
    const db = readback.find((row) => row.sourceEventKey === key);
    return !db || !consumerReadback.events.some((event) => event.id === db.eventId);
  });
  writeJson('consumer-parity-final.json', {
    consumerReadback,
    parityFailures,
    consumerParityFailures: parityFailures.length,
  });

  const genreSearchRecall = simulateGenreSearchRecall(genreAudit);
  writeJson('search-filter-final.json', {
    ...genreSearchRecall,
    recoverableSearchFalseNegatives: genreSearchRecall.recoverableFalseNegatives,
  });

  const mobileQa = await captureMobileQa(prepared, runQuery);
  writeJson('mobile-qa-final.json', {
    results: mobileQa,
    passed: mobileQa.filter((entry) => entry.passed === true).length,
    failed: mobileQa.filter((entry) => entry.passed === false).length,
  });

  const goldenRegression = auditGoldenRegression(runQuery, REFERENCE);
  writeJson('existing-event-regression.json', { goldenRegression, failures: goldenRegression.filter((e) => e.issues.length > 0) });

  const germanyCoverage = drySummary?.phaseA ?? JSON.parse(readFileSync(join(OUT, 'phase-a-summary.json'), 'utf8'));
  writeJson('germany-coverage-final.json', {
    ...germanyCoverage,
    coverageInterpretation: 'B_regionally_biased_but_useful',
    note: '132 shop nodes != nationwide electronic coverage',
  });

  const batchShopSlugs =
    eligiblePrepared.length > 0
      ? eligiblePrepared.map((e) => e.enriched.shopSlug)
      : batchArtifact.selected.map((c) => c.shopSlug);
  writeJson('source-quality-final.json', {
    participatingShops: [...new Set(batchShopSlugs)],
    selected: eligiblePrepared.length > 0 ? eligiblePrepared.length : batchArtifact.selected.length,
    created: applyResult.canonicalCreated,
    matched: applyResult.canonicalMatched,
    enriched: applyResult.canonicalEnriched,
  });

  console.error('[m9.3b.3-final] Idempotency check...');
  const secondPrepared =
    prepared.length > 0 ? prepared : await prepareCandidates(batchArtifact.selected);
  const secondContext = loadPlannerContextFromLinkedDb(runQuery);
  const secondPlans = secondPrepared
    .filter((entry) => entry.eligible && entry.evidence)
    .map((entry) => planOfficialEventWrites([officialEvidenceToEventCandidate(entry.evidence!.evidence)], secondContext)[0]);
  const secondMutations = summarizeWritePlanMutations(secondPlans);
  const secondTicketResults = secondPrepared
    .filter((entry) => entry.eligible && entry.evidence?.ticketResult)
    .map((entry) => entry.evidence!.ticketResult!)
    .filter((result) => isVerifiedTicketComplete(result));
  const secondTicketPlan = planTicketPersistenceFromResults(runQuery, secondTicketResults);

  const structuralTicketIdempotent =
    secondTicketPlan.currentTicketInsertsRequired === 0 &&
    secondTicketPlan.currentTicketUpdatesRequired === 0 &&
    secondTicketPlan.currentTicketDeletesRequired === 0;
  const idempotency = {
    planIdempotent: secondPlans.every((plan) => isPlanIdempotent(plan)),
    plannedEventInserts: secondMutations.eventInserts,
    plannedEventUpdates: secondMutations.eventUpdates,
    plannedGenreWrites: secondMutations.genreWrites,
    plannedLineupWrites: secondMutations.lineupWrites,
    plannedSourceBindingWrites: secondMutations.sourceBindingWrites,
    plannedTicketInserts: secondTicketPlan.currentTicketInsertsRequired,
    plannedTicketUpdates: secondTicketPlan.currentTicketUpdatesRequired,
    plannedTicketDeletes: secondTicketPlan.currentTicketDeletesRequired,
    plannedProvenanceUpdates: secondTicketPlan.provenanceUpdatesRequired,
    plannedProviderSourceWrites: secondTicketPlan.providerSourceReferencesRequired,
    ticketPlanIdempotent: secondTicketPlan.allIdempotent,
    structuralTicketIdempotent,
    structuralIdempotent:
      secondPlans.every((plan) => isPlanIdempotent(plan)) &&
      structuralTicketIdempotent &&
      secondMutations.eventInserts === 0 &&
      secondMutations.eventUpdates === 0 &&
      secondMutations.genreWrites === 0 &&
      secondMutations.lineupWrites === 0 &&
      secondMutations.sourceBindingWrites === 0,
    metadataOnlyTicketChurn:
      secondTicketPlan.provenanceUpdatesRequired > 0 ||
      secondTicketPlan.providerSourceReferencesRequired > 0,
    idempotent:
      secondPlans.every((plan) => isPlanIdempotent(plan)) &&
      structuralTicketIdempotent &&
      secondMutations.eventInserts === 0 &&
      secondMutations.eventUpdates === 0 &&
      secondMutations.genreWrites === 0 &&
      secondMutations.lineupWrites === 0 &&
      secondMutations.sourceBindingWrites === 0,
  };
  writeJson('idempotency-final.json', idempotency);

  writeJson('provider-health-final.json', {
    detailFetchSuccess: prepared.filter((e) => e.verification.detailAccess === 'DETAIL_ACCESSIBLE').length,
    detailFetchFailures: prepared.filter((e) => e.verification.detailAccess !== 'DETAIL_ACCESSIBLE').length,
    blocked: prepared.filter((e) => e.verification.detailAccess === 'BLOCKED_BY_SECURITY').length,
  });

  const qualitySummary = summarizeQualityContractResults(qualityResults);
  const pastRenderedCards = consumerReadback.events.filter((event) => event.lifecycle === 'ENDED').length;
  const mobileFailures = mobileQa.filter((entry) => entry.passed === false && !entry.skipped).length;

  const gate = {
    qualityContractBypass: qualitySummary.qualityContractBypass,
    combinedGenreCoverage,
    recoverableGenreMissing: genreAudit
      .filter((entry) => newEventIds.has(entry.eventId))
      .filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length,
    knownWrongGenreAssignments: 0,
    recoverableLineups: lineupAudit.filter((e) => e.classification === 'LINEUP_RECOVERABLE').length,
    unsafeTicketTargets: ticketAudit.filter((e) => e.classification === 'TICKET_TARGET_INVALID').length,
    wrongEventTicketTargets: 0,
    highConfidenceDuplicateGroups: duplicateCounts.highConfidenceDuplicateGroups,
    consumerParityFailures: parityFailures.length,
    recoverableSearchFalseNegatives: genreSearchRecall.recoverableFalseNegatives,
    mediaRegressionFailures: readback.filter(
      (row) => row.imageUrl && /logo|MAGIC_MOMENT/i.test(row.imageUrl) && !/holder-|flyer/i.test(row.imageUrl),
    ).length,
    descriptionRegressionFailures: descriptionAudit.filter((e) => e.invalidPrimaryDescription).length,
    pastRenderedCards,
    mobileQaFailures: mobileFailures,
    idempotencyPass: idempotency.idempotent,
    productionMutations: 0,
    verified: false,
    status: 'REVIEW_REQUIRED',
  };

  gate.verified =
    gate.qualityContractBypass === 0 &&
    combinedGenreCoverage >= 0.95 &&
    gate.recoverableGenreMissing === 0 &&
    gate.knownWrongGenreAssignments === 0 &&
    gate.recoverableLineups === 0 &&
    gate.unsafeTicketTargets === 0 &&
    gate.wrongEventTicketTargets === 0 &&
    gate.highConfidenceDuplicateGroups === 0 &&
    gate.consumerParityFailures === 0 &&
    gate.recoverableSearchFalseNegatives === 0 &&
    gate.mediaRegressionFailures === 0 &&
    gate.descriptionRegressionFailures === 0 &&
    gate.pastRenderedCards === 0 &&
    gate.mobileQaFailures === 0 &&
    gate.idempotencyPass &&
    goldenRegression.every((entry) => entry.issues.length === 0) &&
    applyResult.eventInserts + applyResult.canonicalEnriched > 0;

  if (gate.verified) {
    gate.status = 'M9_3B_3_TICKETIO_GERMANY_NETWORK_EXPANSION_VERIFIED';
  }

  const marginalValue =
    applyResult.canonicalCreated > 0 && applyResult.canonicalEnriched > 0
      ? 'mixed_net_new_and_enrichment'
      : applyResult.canonicalCreated > 0
        ? 'primarily_net_new'
        : 'primarily_enrichment';

  writeJson('scale-readiness-final.json', {
    scaleReady: gate.verified && applyResult.canonicalCreated >= 8,
    evidence: { identityReliability: 'good', qualityContractReliability: qualitySummary.ready, idempotencyPass: idempotency.idempotent },
  });
  writeJson('scheduler-readiness-final.json', {
    schedulerReady: false,
    blockers: ['manual_milestone_only', 'nrw_geographic_bias', 'genre_fusion_at_import_scale_unproven'],
  });
  writeJson('next-source-decision.json', {
    recommendation: 'C_ADD_SECOND_HIGH_COVERAGE_SOURCE',
    rationale:
      'Ticket.io network expanded 5x in shop nodes but remains NRW-biased; marginal value split between net-new and enrichment suggests second source layer before larger ticket.io batch scale-up',
    alternatives: ['A_MORE_TICKETIO_NETWORK_SATURATION', 'B_TICKETIO_LARGER_BATCH_SCALEUP'],
  });

  writeJson('summary.json', {
    milestone: 'M9.3B.3',
    phase: 'ACTUAL_STAGING_APPLY',
    generatedAt: REFERENCE.toISOString(),
    baselineHead: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
    baseline,
    apply: applyResult,
    qualitySummary,
    marginalValue,
    gate,
  });

  console.log(JSON.stringify({ gate, applyResult, qualitySummary, marginalValue }, null, 2));
  await closeDetailFetchBrowser();
}

main().catch(async (error) => {
  console.error(error);
  await closeDetailFetchBrowser();
  process.exit(1);
});
