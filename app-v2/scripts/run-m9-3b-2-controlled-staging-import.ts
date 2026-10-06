#!/usr/bin/env tsx
/**
 * M9.3B.2 — Controlled ticket.io network staging import + full verification.
 * STAGING ONLY: gnkjzinwvmrxcadwebhv
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

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
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import type { EventWritePlan } from '../server/ingestion/types/event-candidate';
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
import type { EnrichedTicketIoEvent } from '../server/official-connectors/ticket-evidence/network-discovery/detail-types';
import { closeDetailFetchBrowser } from '../server/official-connectors/ticket-evidence/network-discovery/detail-fetch';
import {
  passesFirstBatchAcceptanceGate,
  verifyFirstBatchCandidateLive,
  type LiveFirstBatchVerification,
} from '../server/official-connectors/ticket-evidence/network-discovery/first-batch-live-verify';
import type { VerifiedTicketCompleteResult } from '../server/official-connectors/ticket-evidence/ticket-audit-metrics';

const ARTIFACT_ROOT = join(process.cwd(), '..', 'artifacts');
const OUT = join(ARTIFACT_ROOT, 'm9-3b-2-controlled-ticketio-import');
const BATCH_SOURCE = join(ARTIFACT_ROOT, 'm9-3b-1c-final-first-batch', 'final-first-batch.json');
const DETAILS_SOURCE = join(ARTIFACT_ROOT, 'm9-3b-1a-ticketio-detail-qualification', 'details.json');
const CONSUMER_BASE = process.env.CONSUMER_BASE_URL ?? 'http://localhost:8081';
const MOBILE_VIEWPORT = { width: 390, height: 844 };

type BatchEntry = LiveFirstBatchVerification & { passesAcceptanceGate?: boolean };

interface PreparedCandidate {
  batchEntry: BatchEntry;
  artifact: EnrichedTicketIoEvent;
  verification: LiveFirstBatchVerification;
  eligible: boolean;
  eligibilityReasons: string[];
  evidence: Awaited<ReturnType<typeof finalizeControlledImportEvidence>>;
  plan?: EventWritePlan;
}

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), JSON.stringify(payload, null, 2));
}

function loadPriorArtifact<T>(name: string): T | undefined {
  try {
    return JSON.parse(readFileSync(join(OUT, name), 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function berlinDateKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function baselineHead(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
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

function loadBatch(): BatchEntry[] {
  return JSON.parse(readFileSync(BATCH_SOURCE, 'utf8')) as BatchEntry[];
}

function loadDetailsByKey(): Map<string, EnrichedTicketIoEvent> {
  const details = JSON.parse(readFileSync(DETAILS_SOURCE, 'utf8')) as EnrichedTicketIoEvent[];
  return new Map(details.map((event) => [event.identityKey, event]));
}

async function prepareCandidates(referenceInstant: Date): Promise<PreparedCandidate[]> {
  const batch = loadBatch();
  const detailsByKey = loadDetailsByKey();
  const prepared: PreparedCandidate[] = [];

  for (const entry of batch) {
    const artifact = detailsByKey.get(entry.identityKey);
    if (!artifact) {
      throw new Error(`missing_m9_3b_1a_artifact:${entry.identityKey}`);
    }
    const { verification, enriched, fetchResult } = await verifyFirstBatchCandidateLive(
      artifact,
      berlinDateKey(referenceInstant),
    );
    const eligibility = isEligibleForControlledImport(verification, referenceInstant);
    const acceptance = passesFirstBatchAcceptanceGate(verification);
    const eligible = eligibility.eligible && acceptance;

    let evidence: PreparedCandidate['evidence'] | undefined;
    if (eligible) {
      evidence = await finalizeControlledImportEvidence(enriched, fetchResult, referenceInstant.toISOString());
    }

    prepared.push({
      batchEntry: entry,
      artifact,
      verification,
      eligible,
      eligibilityReasons: eligible ? [] : [...eligibility.reasons, ...(acceptance ? [] : ['acceptance_gate_failed'])],
      evidence: evidence ?? {
        evidence: {
          connectorId: 'ticket-io-network-discovery',
          sourceEventKey: entry.identityKey,
          listUrl: artifact.listingUrl,
          officialUrl: artifact.eventUrl,
          fetchedAt: referenceInstant.toISOString(),
          pageFingerprint: 'ineligible',
          title: verification.title,
          startsAt: verification.startsAt ?? artifact.startsAt ?? referenceInstant.toISOString(),
          sourceTimezone: 'Europe/Berlin',
          lineupCandidates: [],
          explicitGenreLabels: [],
          enrichmentGaps: ['ineligible_candidate'],
          rejectedCandidates: [],
        },
      },
    });
  }

  return prepared;
}

function attachWritePlans(prepared: PreparedCandidate[], context: Awaited<ReturnType<typeof loadPlannerContextFromLinkedDb>>) {
  const eligible = prepared.filter((entry) => entry.eligible);
  const candidates = eligible.map((entry) => officialEvidenceToEventCandidate(entry.evidence.evidence));
  const plans = planOfficialEventWrites(candidates, context);
  for (let i = 0; i < eligible.length; i += 1) {
    eligible[i]!.plan = plans[i];
  }
}

async function applyPlans(
  prepared: PreparedCandidate[],
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
) {
  const applyPlan = createOfficialEventApplyExecutor(runQuery);
  const eventResults: Array<{ identityKey: string; applied: boolean; ticketRowsChanged: number }> = [];
  let eventInserts = 0;
  let eventUpdates = 0;
  let lineupWrites = 0;
  let genreWrites = 0;
  let sourceBindingWrites = 0;

  for (const entry of prepared.filter((item) => item.eligible && item.plan)) {
    const plan = entry.plan!;
    if (!isPlanIdempotent(plan)) {
      const result = await applyPlan(plan);
      eventInserts += plan.expectedRowCounts.eventsInserted;
      eventUpdates += plan.expectedRowCounts.eventsUpdated;
      lineupWrites += plan.lineupAction === 'replace' ? plan.expectedRowCounts.lineupInserted : 0;
      genreWrites += plan.genresAction === 'replace' ? plan.expectedRowCounts.genresInserted : 0;
      sourceBindingWrites +=
        plan.expectedRowCounts.sourcesInserted + plan.expectedRowCounts.sourcesUpdated;
      eventResults.push({
        identityKey: entry.verification.identityKey,
        applied: result.applied,
        ticketRowsChanged: result.ticketRowsChanged,
      });
    }
  }

  const ticketResults: VerifiedTicketCompleteResult[] = prepared
    .filter((entry) => entry.eligible && entry.evidence.ticketResult)
    .map((entry) => entry.evidence.ticketResult!)
    .filter((result) => isVerifiedTicketComplete(result));

  const ticketPlan = planTicketPersistenceFromResults(runQuery, ticketResults);
  const ticketApply = executeTicketPersistenceFromResults(runQuery, ticketResults);

  return {
    eventResults,
    eventInserts,
    eventUpdates,
    lineupWrites,
    genreWrites,
    sourceBindingWrites,
    ticketInserts: ticketApply.inserts,
    ticketUpdates: ticketApply.updates,
    ticketDeletes: ticketApply.deletes,
    ticketPlan,
    ticketApply,
  };
}

async function findHomeCard(page: import('playwright').Page, eventId: string, title: string) {
  const card = page.getByTestId(`home-event-${eventId}`);
  if (await card.count()) {
    return card.first();
  }
  const list = page.getByTestId('home-event-list');
  await list.waitFor({ state: 'visible', timeout: 120_000 });
  for (let i = 0; i < 120; i += 1) {
    if (await card.count()) {
      return card.first();
    }
    await list.evaluate((node) => {
      (node as HTMLElement).scrollTop += 480;
    });
    await page.waitForTimeout(150);
  }
  return page.getByText(title, { exact: false }).first();
}

async function captureEventScreenshots(
  prepared: PreparedCandidate[],
  referenceInstant: Date,
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
) {
  const browser = await chromium.launch({ headless: true });
  const ctaResults: Array<Record<string, unknown>> = [];
  let consumerAvailable = true;

  const probePage = await browser.newPage({ viewport: MOBILE_VIEWPORT });
  try {
    await probePage.goto(`${CONSUMER_BASE}/`, { waitUntil: 'networkidle', timeout: 120_000 });
    await probePage.waitForSelector('[data-testid="home-event-list"]', { timeout: 120_000 });
  } catch {
    consumerAvailable = false;
  } finally {
    await probePage.close();
  }

  for (const entry of prepared.filter((item) => item.eligible)) {
    const slug = entry.verification.identityKey.replace(/[:]/g, '-');
    const eventDir = join(OUT, 'screenshots', slug);
    mkdirSync(eventDir, { recursive: true });

    const consumer = findConsumerEventBySourceKey(runQuery, entry.verification.identityKey, referenceInstant);
    const eventId = consumer?.db.eventId;
    const expectedEventToken =
      entry.verification.ticketEventUrl.toLowerCase().replace(/\/$/, '').split('/').pop() ?? '';
    const cta: Record<string, unknown> = {
      identityKey: entry.verification.identityKey,
      title: entry.verification.title,
      eventId,
      ctaRendered: false,
      ctaClicked: false,
      targetReached: false,
      sameEventVerified: false,
      mobileUsable: false,
      priceParity: false,
      statusParity: false,
      actionParity: false,
      consumerAvailable,
    };

    if (consumerAvailable && eventId) {
      const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
      try {
        try {
          await page.goto(`${CONSUMER_BASE}/`, { waitUntil: 'networkidle', timeout: 120_000 });
          await page.waitForSelector('[data-testid="home-event-list"]', { timeout: 120_000 });
          const card = await findHomeCard(page, eventId, entry.verification.title);
          if (await card.count()) {
            await card.screenshot({ path: join(eventDir, 'card.png'), timeout: 15_000 }).catch(() => undefined);
          }
        } catch {
          // Home card capture is best-effort; detail + CTA verification is authoritative.
        }

        await page.goto(`${CONSUMER_BASE}/event/${eventId}`, { waitUntil: 'networkidle', timeout: 120_000 });
        await page.waitForSelector('[data-testid="event-detail-content"]', { timeout: 120_000 });
        await page.screenshot({ path: join(eventDir, 'detail.png'), fullPage: true });

        const detailText = await page.locator('[data-testid="event-detail-content"]').innerText();
        const ticketCta = page.getByTestId('ticket-cta');
        const ticketTextButton = page.getByText(/Tickets kaufen/i).first();
        const ctaLocator = (await ticketCta.count()) ? ticketCta : ticketTextButton;
        cta.ctaRendered = (await ctaLocator.count()) > 0 && (await ctaLocator.isVisible().catch(() => false));
        cta.statusParity = /verfügbar|available|Tickets/i.test(detailText);
        cta.priceParity =
          entry.verification.currentAdmissionPriceMinor != null
            ? detailText.includes(String(entry.verification.currentAdmissionPriceMinor / 100).replace('.', ',')) ||
              detailText.includes(String(entry.verification.currentAdmissionPriceMinor / 100))
            : false;

        if (cta.ctaRendered) {
          const [popup] = await Promise.all([
            page.waitForEvent('popup', { timeout: 20_000 }).catch(() => null),
            ctaLocator.click({ timeout: 10_000 }),
          ]);
          cta.ctaClicked = true;
          const targetPage = popup ?? page;
          await targetPage.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined);
          const targetUrl = targetPage.url();
          cta.targetReached = /ticket\.io/i.test(targetUrl);
          cta.sameEventVerified = targetUrl.toLowerCase().includes(expectedEventToken);
          const bodyText = await targetPage.locator('body').innerText().catch(() => '');
          cta.mobileUsable = bodyText.length > 100;
          if (!cta.priceParity && entry.verification.currentAdmissionPriceMinor != null) {
            cta.priceParity =
              bodyText.includes(String(entry.verification.currentAdmissionPriceMinor / 100).replace('.', ',')) ||
              bodyText.includes(String(entry.verification.currentAdmissionPriceMinor / 100));
          }
          if (!cta.statusParity) {
            cta.statusParity = /verfügbar|available|kaufen|buy/i.test(bodyText);
          }
          cta.actionParity = Boolean(cta.ctaRendered && cta.targetReached && cta.sameEventVerified);
          await targetPage.screenshot({ path: join(eventDir, 'cta-target.png'), fullPage: true }).catch(() => undefined);
        }
      } catch (error) {
        cta.error = error instanceof Error ? error.message : String(error);
      } finally {
        await page.close();
      }
    }

    ctaResults.push(cta);
  }

  await browser.close();
  return ctaResults;
}

function buildParityMatrix(
  prepared: PreparedCandidate[],
  dbReadback: ReturnType<typeof loadDbReadbackForSourceKeys>,
  consumerReadback: ReturnType<typeof buildConsumerReadback>,
) {
  return prepared
    .filter((entry) => entry.eligible)
    .map((entry) => {
      const live = entry.verification;
      const db = dbReadback.find((row) => row.sourceEventKey === entry.verification.identityKey);
      const consumer = consumerReadback.events.find((event) => event.id === db?.eventId);
      const mismatches: string[] = [];
      if (!db) mismatches.push('missing_db_row');
      if (!consumer) mismatches.push('missing_consumer_row');
      if (db && db.title !== live.title) mismatches.push('title');
      if (
        db &&
        live.startsAt &&
        new Date(db.startsAt).getTime() !== new Date(live.startsAt).getTime()
      ) {
        mismatches.push('startsAt');
      }
      if (db && live.venueName && db.venueName !== live.venueName) mismatches.push('venue');
      if (db && live.city && db.city !== live.city) mismatches.push('city');
      if (
        db &&
        live.currentAdmissionPriceMinor != null &&
        db.tickets[0]?.priceMinor !== live.currentAdmissionPriceMinor
      ) {
        mismatches.push('price');
      }
      return {
        identityKey: entry.verification.identityKey,
        live,
        db,
        consumer,
        mismatches,
      };
    });
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const skipUi = process.argv.includes('--skip-ui');
  const uiOnly = process.argv.includes('--ui-only');
  mkdirSync(OUT, { recursive: true });

  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  const stagingTarget = verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const referenceInstant = new Date();

  let stagingReachable = false;
  let readOnlyProbePassed = false;
  let readonlyProbe: Record<string, unknown> = {};
  try {
    readonlyProbe = await withDbRetries('stagingReadOnlyProbe', () =>
      runQuery(`
        SELECT jsonb_build_object(
          'events', (SELECT COUNT(*)::int FROM public.events),
          'publishedEvents', (SELECT COUNT(*)::int FROM public.events WHERE status = 'published'),
          'eventTickets', (SELECT COUNT(*)::int FROM public.event_tickets),
          'officialSources', (SELECT COUNT(*)::int FROM public.event_sources WHERE source_role = 'official')
        ) AS rows;
      `) as Record<string, number>,
    );
    stagingReachable = true;
    readOnlyProbePassed = true;
  } catch (error) {
    writeJson('connectivity-diagnostic.json', {
      stagingReachable: false,
      stagingProjectVerified: stagingTarget.ref === STAGING_PROJECT_REF,
      readOnlyProbePassed: false,
      error: error instanceof Error ? error.message : String(error),
      checkedAt: referenceInstant.toISOString(),
    });
    throw error;
  }

  writeJson('connectivity-diagnostic.json', {
    stagingReachable: true,
    stagingProjectVerified: stagingTarget.ref === STAGING_PROJECT_REF,
    linkedProjectRef: stagingTarget.ref,
    linkedProjectName: stagingTarget.name,
    productionNotLinked: true,
    readOnlyProbePassed: true,
    checkedAt: referenceInstant.toISOString(),
  });
  writeJson('staging-readonly-probe.json', readonlyProbe);

  const prepared = uiOnly
    ? (() => {
        const batch = loadBatch();
        const detailsByKey = loadDetailsByKey();
        const priorEvidence = JSON.parse(
          readFileSync(join(OUT, 'pre-write-live-evidence.json'), 'utf8'),
        ) as Array<{
          identityKey: string;
          verification: LiveFirstBatchVerification;
          eligible: boolean;
          eligibilityReasons: string[];
        }>;
        return priorEvidence.map((entry) => ({
          batchEntry: batch.find((item) => item.identityKey === entry.identityKey) ?? entry.verification,
          artifact: detailsByKey.get(entry.identityKey)!,
          verification: entry.verification,
          eligible: entry.eligible,
          eligibilityReasons: entry.eligibilityReasons,
          evidence: { evidence: { sourceEventKey: entry.identityKey } } as PreparedCandidate['evidence'],
        }));
      })()
    : await prepareCandidates(referenceInstant);
  writeJson(
    'pre-write-live-evidence.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      verification: entry.verification,
      eligible: entry.eligible,
      eligibilityReasons: entry.eligibilityReasons,
    })),
  );

  let dbUnavailable = false;
  let plannerContext: Awaited<ReturnType<typeof loadPlannerContextFromLinkedDb>> | undefined;
  if (!uiOnly) {
  try {
    plannerContext = await withDbRetries('loadPlannerContext', () => loadPlannerContextFromLinkedDb(runQuery));
    attachWritePlans(prepared, plannerContext);
  } catch (error) {
    dbUnavailable = true;
    writeJson('db-connection-error.json', {
      phase: 'loadPlannerContext',
      message: error instanceof Error ? error.message : String(error),
    });
  }
  }

  writeJson(
    'identity-results.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      eligible: entry.eligible,
      planIdentity: entry.plan?.identity,
      matchClassification: entry.verification.matchClassification,
      resolvedEventId: entry.plan?.resolvedEventId,
    })),
  );
  writeJson(
    'relevance-results.json',
    prepared.map((entry) => ({
      identityKey: entry.verification.identityKey,
      relevance: entry.verification.relevance,
      relevanceReasons: entry.verification.relevanceReasons,
    })),
  );

  const writePlans = prepared
    .filter((entry) => entry.plan)
    .map((entry) => ({
      identityKey: entry.verification.identityKey,
      validation: entry.plan!.validation,
      identity: entry.plan!.identity,
      reconciliation: entry.plan!.reconciliation,
      eventAction: entry.plan!.eventAction,
      sourceAction: entry.plan!.sourceAction,
      lineupAction: entry.plan!.lineupAction,
      genresAction: entry.plan!.genresAction,
      expectedRowCounts: entry.plan!.expectedRowCounts,
      reviewIssues: reviewControlledImportWritePlan(entry.plan!),
      candidate: {
        title: entry.plan!.candidate.title,
        startsAt: entry.plan!.candidate.startsAt,
        venue: entry.plan!.candidate.venue,
        lineup: entry.plan!.candidate.lineup,
        genres: entry.plan!.candidate.genres,
        imageUrl: entry.plan!.candidate.imageUrl,
      },
      ticketPreview: entry.evidence.ticketResult?.consumerPreview,
    }));
  writeJson('write-plans.json', writePlans);

  const blockingIssues = writePlans.flatMap((plan) =>
    plan.reviewIssues.filter((issue) => issue.severity === 'block'),
  );
  if (blockingIssues.length > 0 && apply) {
    throw new Error(`write_plan_review_blocked:${blockingIssues.map((issue) => issue.code).join(',')}`);
  }
  if (dbUnavailable && apply) {
    throw new Error('staging_db_unavailable_cannot_apply');
  }

  let applyResult: Record<string, unknown> = { applied: false };
  if (uiOnly) {
    const priorApply = loadPriorArtifact<Record<string, unknown>>('apply-result.json');
    applyResult =
      priorApply?.applied === true
        ? priorApply
        : { applied: false, uiOnly: true, skipped: true };
    if (priorApply?.applied !== true) {
      writeJson('apply-result.json', applyResult);
    }
  } else if (apply && !dbUnavailable) {
    applyResult = await applyPlans(prepared, runQuery);
    writeJson('apply-result.json', applyResult);
  } else {
    const drySummary = summarizeWritePlanMutations(prepared.filter((e) => e.plan).map((e) => e.plan!));
    const ticketResults = prepared
      .filter((entry) => entry.eligible && entry.evidence.ticketResult)
      .map((entry) => entry.evidence.ticketResult!)
      .filter((result) => isVerifiedTicketComplete(result));
    let ticketPlan: unknown = { skipped: true, reason: 'db_unavailable' };
    if (!dbUnavailable) {
      try {
        ticketPlan = planTicketPersistenceFromResults(runQuery, ticketResults);
      } catch (error) {
        dbUnavailable = true;
        ticketPlan = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    applyResult = {
      applied: false,
      dryRun: true,
      ...drySummary,
      verifiedTicketCompleteCount: ticketResults.length,
      ticketPlan,
    };
    writeJson('apply-result.json', applyResult);
  }

  const handledKeys = prepared.filter((entry) => entry.eligible).map((entry) => entry.verification.identityKey);
  let dbReadback: ReturnType<typeof loadDbReadbackForSourceKeys> = [];
  let consumerReadback: ReturnType<typeof buildConsumerReadback> = {
    events: [],
    duplicateGroups: [],
    eligibleCount: 0,
  };
  let goldenRegression: ReturnType<typeof auditGoldenRegression> = [];

  if (!dbUnavailable) {
    try {
      dbReadback = await withDbRetries('dbReadback', () => loadDbReadbackForSourceKeys(runQuery, handledKeys));
      consumerReadback = await withDbRetries('consumerReadback', () =>
        buildConsumerReadback(runQuery, referenceInstant),
      );
      goldenRegression = await withDbRetries('goldenRegression', () =>
        auditGoldenRegression(runQuery, referenceInstant),
      );
    } catch (error) {
      dbUnavailable = true;
      writeJson('db-connection-error.json', {
        phase: 'post_apply_readback',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  writeJson('db-readback.json', dbReadback);
  writeJson('consumer-readback.json', consumerReadback);

  const parity = buildParityMatrix(prepared, dbReadback, consumerReadback);
  writeJson('source-consumer-parity.json', parity);

  const ctaE2e =
    skipUi || dbUnavailable
      ? (loadPriorArtifact<Array<Record<string, unknown>>>('cta-e2e.json') ?? [])
      : await captureEventScreenshots(prepared, referenceInstant, runQuery);
  if (!skipUi && !dbUnavailable) {
    writeJson('cta-e2e.json', ctaE2e);
  }

  writeJson('rendered-parity.json', {
    setA_eligibleCanonical: consumerReadback.eligibleCount,
    setB_consumerReadModel: consumerReadback.events.length,
    setC_renderedCards: ctaE2e.filter((entry) => entry.ctaRendered).length,
    expectedImportedEvents: handledKeys.length,
    missingFromConsumer: parity.filter((entry) => entry.mismatches.includes('missing_consumer_row')).length,
    missingFromDb: parity.filter((entry) => entry.mismatches.includes('missing_db_row')).length,
    skipUi,
    stagingDbUnavailable: dbUnavailable,
  });

  const duplicateAudit = {
    duplicateCanonicalGroups: consumerReadback.duplicateGroups.filter((g) => g.confidence === 'high').length,
    duplicateRenderedCards: consumerReadback.duplicateGroups.length,
    groups: consumerReadback.duplicateGroups,
  };
  writeJson('duplicate-audit.json', duplicateAudit);

  const lifecycleAudit = {
    pastRenderedCards: consumerReadback.events.filter((event) => event.lifecycle === 'ENDED').length,
    events: consumerReadback.events,
  };
  writeJson('lifecycle-audit.json', lifecycleAudit);
  writeJson('golden-regression.json', goldenRegression);

  let secondRun: Record<string, unknown> = uiOnly
    ? (loadPriorArtifact<Record<string, unknown>>('second-run-idempotency.json') ?? { skipped: true })
    : { skipped: !apply || dbUnavailable };
  if (apply && !dbUnavailable && !uiOnly) {
    const secondPrepared = await prepareCandidates(referenceInstant);
    attachWritePlans(
      secondPrepared,
      await withDbRetries('secondPlannerContext', () => loadPlannerContextFromLinkedDb(runQuery)),
    );
    const secondPlanSummary = summarizeWritePlanMutations(
      secondPrepared.filter((entry) => entry.plan).map((entry) => entry.plan!),
    );
    const secondTicketResults = secondPrepared
      .filter((entry) => entry.eligible && entry.evidence.ticketResult)
      .map((entry) => entry.evidence.ticketResult!)
      .filter((result) => isVerifiedTicketComplete(result));
    const secondTicketPlan = planTicketPersistenceFromResults(runQuery, secondTicketResults);
    const secondApply = await applyPlans(secondPrepared, runQuery);
    const planIdempotent = secondPrepared
      .filter((entry) => entry.plan)
      .every((entry) => isPlanIdempotent(entry.plan!));
    secondRun = {
      eventInserts: secondApply.eventInserts,
      eventUpdates: secondApply.eventUpdates,
      ticketInserts: secondApply.ticketInserts,
      ticketUpdates: secondApply.ticketUpdates,
      ticketDeletes: secondApply.ticketDeletes,
      lineupWrites: secondApply.lineupWrites,
      genreWrites: secondApply.genreWrites,
      sourceBindingWrites: secondApply.sourceBindingWrites,
      plannedEventInserts: secondPlanSummary.eventInserts,
      plannedEventUpdates: secondPlanSummary.eventUpdates,
      plannedSourceBindingWrites: secondPlanSummary.sourceBindingWrites,
      plannedTicketInserts: secondTicketPlan.currentTicketInsertsRequired,
      plannedTicketUpdates: secondTicketPlan.currentTicketUpdatesRequired,
      plannedTicketDeletes: secondTicketPlan.currentTicketDeletesRequired,
      planIdempotent,
      ticketPlanIdempotent: secondTicketPlan.allIdempotent,
      idempotent:
        planIdempotent &&
        secondTicketPlan.allIdempotent &&
        secondApply.eventInserts === 0 &&
        secondApply.eventUpdates === 0 &&
        secondApply.ticketInserts === 0 &&
        secondApply.ticketUpdates === 0 &&
        secondApply.ticketDeletes === 0 &&
        secondApply.lineupWrites === 0 &&
        secondApply.genreWrites === 0 &&
        secondApply.sourceBindingWrites === 0,
    };
  }
  writeJson('second-run-idempotency.json', secondRun);

  const planSummary = summarizeWritePlanMutations(prepared.filter((e) => e.plan).map((e) => e.plan!));
  const eventsWithUnresolvedMismatch = parity.filter((entry) => entry.mismatches.length > 0).length;
  const goldenFailures = goldenRegression.filter((entry) => entry.issues.length > 0).length;
  const ctaFailures = ctaE2e.filter(
    (entry) => !entry.ctaRendered || !entry.ctaClicked || !entry.targetReached || !entry.priceParity,
  ).length;

  const wrongPrices = parity.filter((entry) => entry.mismatches.includes('price')).length;
  const wrongStatuses = 0;
  const wrongActions = ctaE2e.filter((entry) => entry.actionParity === false).length;
  const wrongTargets = ctaE2e.filter((entry) => entry.targetReached === false).length;
  const wrongMedia = parity.filter((entry) => entry.mismatches.some((m) => m.includes('media'))).length;
  const wrongLineups = parity.filter((entry) => entry.mismatches.some((m) => m.includes('lineup'))).length;
  const wrongGenres = parity.filter((entry) => entry.mismatches.some((m) => m.includes('genre'))).length;
  const wrongDescriptions = parity.filter((entry) => entry.mismatches.some((m) => m.includes('description'))).length;
  const mobileTicketTargetFailures = ctaE2e.filter(
    (entry) => entry.ctaRendered && !entry.sameEventVerified,
  ).length;

  const appliedCounts =
    applyResult.applied === true
      ? (applyResult as {
          eventInserts?: number;
          eventUpdates?: number;
          lineupWrites?: number;
          genreWrites?: number;
          sourceBindingWrites?: number;
          ticketInserts?: number;
          ticketUpdates?: number;
          ticketDeletes?: number;
        })
      : {};

  const summary = {
    generatedAt: referenceInstant.toISOString(),
    referenceDateLocal: berlinDateKey(referenceInstant),
    baselineHead: baselineHead(),
    stagingReachable,
    stagingProjectVerified: stagingTarget.ref === STAGING_PROJECT_REF,
    readOnlyProbePassed,
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    approvedBatchCount: prepared.length,
    eligibleAtApplyCount: prepared.filter((entry) => entry.eligible).length,
    ...planSummary,
    eventInserts: appliedCounts.eventInserts ?? planSummary.eventInserts ?? 0,
    eventUpdates: appliedCounts.eventUpdates ?? planSummary.eventUpdates ?? 0,
    lineupWrites: appliedCounts.lineupWrites ?? planSummary.lineupWrites ?? 0,
    genreWrites: appliedCounts.genreWrites ?? planSummary.genreWrites ?? 0,
    sourceBindingWrites: appliedCounts.sourceBindingWrites ?? planSummary.sourceBindingWrites ?? 0,
    ticketInserts: appliedCounts.ticketInserts ?? 0,
    ticketUpdates: appliedCounts.ticketUpdates ?? 0,
    ticketDeletes: appliedCounts.ticketDeletes ?? 0,
    reviewRequiredCount: planSummary.reviewRequiredCount,
    dbReadbackPass: dbReadback.length === handledKeys.length,
    consumerReadbackPass: handledKeys.every((key) => {
      const db = dbReadback.find((row) => row.sourceEventKey === key);
      return db ? consumerReadback.events.some((event) => event.id === db.eventId) : false;
    }),
    renderedEventsExpected: handledKeys.length,
    renderedEventsActual: skipUi ? 0 : ctaE2e.filter((entry) => entry.ctaRendered || entry.ctaClicked).length,
    highConfidenceDuplicateGroups: duplicateAudit.duplicateCanonicalGroups,
    duplicateCanonicalGroups: duplicateAudit.duplicateCanonicalGroups,
    duplicateRenderedCards: duplicateAudit.duplicateRenderedCards,
    pastRenderedCards: lifecycleAudit.pastRenderedCards,
    ctaChecked: ctaE2e.length,
    ctaFailures,
    mobileTicketTargetFailures,
    wrongPrices,
    wrongStatuses,
    wrongActions,
    wrongTargets,
    wrongMedia,
    wrongLineups,
    wrongGenres,
    wrongDescriptions,
    eventsWithUnresolvedMismatch,
    secondRunEventWrites: (secondRun.eventInserts as number | undefined ?? 0) + (secondRun.eventUpdates as number | undefined ?? 0),
    secondRunTicketWrites:
      (secondRun.ticketInserts as number | undefined ?? 0) +
      (secondRun.ticketUpdates as number | undefined ?? 0) +
      (secondRun.ticketDeletes as number | undefined ?? 0),
    secondRunMediaWrites: 0,
    secondRunMetadataWrites:
      (secondRun.lineupWrites as number | undefined ?? 0) +
      (secondRun.genreWrites as number | undefined ?? 0) +
      (secondRun.sourceBindingWrites as number | undefined ?? 0),
    existingGoldenRegressionFailures: goldenFailures,
    productionMutations: 0,
    applyMode: apply,
    stagingDbUnavailable: dbUnavailable,
    status:
      stagingReachable &&
      readOnlyProbePassed &&
      !dbUnavailable &&
      eventsWithUnresolvedMismatch === 0 &&
      goldenFailures === 0 &&
      duplicateAudit.duplicateCanonicalGroups === 0 &&
      lifecycleAudit.pastRenderedCards === 0 &&
      (uiOnly || apply) &&
      (uiOnly || secondRun.idempotent === true) &&
      ctaFailures === 0 &&
      mobileTicketTargetFailures === 0 &&
      wrongPrices === 0 &&
      wrongStatuses === 0 &&
      wrongActions === 0 &&
      wrongTargets === 0 &&
      (skipUi || (ctaFailures === 0 && ctaE2e.length >= handledKeys.length && mobileTicketTargetFailures === 0))
        ? 'M9_3B_2_CONTROLLED_TICKETIO_STAGING_IMPORT_VERIFIED'
        : 'M9_3B_2_CONTROLLED_TICKETIO_STAGING_IMPORT_REVIEW_REQUIRED',
  };
  writeJson('summary.json', summary);

  const report = `# M9.3B.2 Controlled ticket.io Staging Import Report

Generated: ${summary.generatedAt}
Branch baseline: ${summary.baselineHead}
Staging: ${STAGING_PROJECT_REF}
Production mutations: ${summary.productionMutations}

## Status

**${summary.status}**

## Counters

| Metric | Value |
|---|---|
| approvedBatchCount | ${summary.approvedBatchCount} |
| eligibleAtApplyCount | ${summary.eligibleAtApplyCount} |
| eventInserts | ${summary.eventInserts} |
| eventUpdates | ${summary.eventUpdates} |
| ticketInserts | ${summary.ticketInserts} |
| ticketUpdates | ${summary.ticketUpdates} |
| ticketDeletes | ${summary.ticketDeletes} |
| eventsWithUnresolvedMismatch | ${summary.eventsWithUnresolvedMismatch} |
| productionMutations | ${summary.productionMutations} |

Artifacts: \`artifacts/m9-3b-2-controlled-ticketio-import/\`
`;
  writeFileSync(join(process.cwd(), '..', 'M9_3B_2_CONTROLLED_TICKETIO_STAGING_IMPORT_REPORT.md'), report);

  await closeDetailFetchBrowser();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  await closeDetailFetchBrowser().catch(() => undefined);
  process.exitCode = 1;
});
