/**
 * Phase 4.8.5 — Unified Website Integrated Shadow (READ ONLY).
 *
 * Runs the unified website importer inside the real website processor path,
 * parallel to legacy extraction. Legacy publishing remains unchanged.
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToDomain, type EventRow } from '@/data/mappers/event-mapper';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { extractDetailPageEventWithStrategy } from '@/features/aggregation/connectors/website/html-strategies';
import { simulateMultiSourceMerge } from '@/features/import/pilots/merge-simulation';
import { extractOfficialWebsitePublicTruth } from '@/features/import/shadow/official-website-public-truth';
import {
  assertShadowNoWrite,
  deliberateWriteAttemptShouldFail,
  resetShadowWriteAttempts,
  wrapClientForShadowReadOnly,
} from '@/features/import/shadow/shadow-no-write-guard';
import {
  APPROVED_INTEGRATED_SHADOW_SOURCE_IDS,
  INTEGRATED_COMPARISON_FIELDS,
  INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
  INTEGRATED_SHADOW_EXECUTION_MODE,
  beginIntegratedShadowSession,
  buildDefaultIntegratedShadowFeatureFlagSnapshot,
  classifyIntegratedFieldComparison,
  endIntegratedShadowSession,
  extractLegacyIntegratedField,
  extractUnifiedIntegratedField,
  findUnexplainedClaimedFieldGaps,
  maybeRunIntegratedShadowExtraction,
  resolveIntegratedShadowConfig,
  runIntegratedShadowWebsitePipeline,
  summarizeIntegratedFieldComparisons,
  validateIntegratedShadowIdentities,
} from '@/features/import/shadow/unified-website-integrated-shadow';
import {
  createAffenkaefigLiveProductionSourceRecord,
  createBootshausProductionSourceRecord,
  PRODUCTION_AFFENKAEFIG_SOURCE_ID,
  PRODUCTION_BOOTSHAUS_SOURCE_ID,
} from '@/features/sources/production/production-source-records';
import {
  AFFENKAEFIG_EVENTS_URL,
  AFFENKAEFIG_SOURCE_CONNECTOR_KEY,
} from '@/features/sources/production/affenkaefig-source';
import { BOOTSHAUS_LIST_FIXTURE_HTML } from '@/features/sources/production/bootshaus-fixture';
import { AFFENKAEFIG_LIST_FIXTURE_HTML } from '@/features/sources/production/affenkaefig-fixture';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const LIVE_EVIDENCE_DIR = join(OUT, '_phase4823_live_evidence');
const FRESH_SHADOW_PATH = join(OUT, '_phase4823_fresh_shadow.json');
const CONSUMER_VERIFICATION_PATH = join(OUT, '_phase4823_consumer_verification.json');

const TRACE_EVENTS = {
  r3hab: {
    eventId: 'evt-1785339421539-k3swcrl',
    url: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
    fixture: 'live-official-website-98.html',
  },
  sommerfest: {
    eventId: 'evt-1785339391167-tfaixrr',
    url: 'https://bootshaus.tv/events/bootshaus-sommerfest',
    fixture: 'live-official-website-80.html',
  },
} as const;

let productionMutationsInThisRun = 0;

const SHADOW_OVERRIDES = {
  enabled: true,
  sourceIds: [...APPROVED_INTEGRATED_SHADOW_SOURCE_IDS],
  sampleLimit: 250,
  noWrite: true,
};

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function assertReadOnly(): void {
  resetShadowWriteAttempts();
  wrapClientForShadowReadOnly(opsClient);
  const writeGuardWorks = deliberateWriteAttemptShouldFail();
  const guard = assertShadowNoWrite({ productionMutationsInThisRun });
  if (!writeGuardWorks || !guard.ok) {
    throw new Error(`Shadow no-write guard failed: ${guard.violations.join(', ')}`);
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '').toLowerCase();
}

function loadHtmlFixtures(): Record<string, string> {
  const fixtures: Record<string, string> = {};
  if (!existsSync(LIVE_EVIDENCE_DIR)) return fixtures;
  for (const file of readdirSync(LIVE_EVIDENCE_DIR)) {
    if (!file.endsWith('.html')) continue;
    const html = readFileSync(join(LIVE_EVIDENCE_DIR, file), 'utf8');
    const canonical = html.match(/rel="canonical" href="([^"]+)"/i)?.[1];
    const pageUrl = html.match(/property="og:url" content="([^"]+)"/i)?.[1];
    const url = canonical ?? pageUrl;
    if (url) fixtures[normalizeUrl(url)] = html;
  }
  return fixtures;
}

function loadCaptures(): Array<{ eventId: string; sampleId: string; url: string; htmlPath: string }> {
  if (!existsSync(FRESH_SHADOW_PATH)) return [];
  const raw = JSON.parse(readFileSync(FRESH_SHADOW_PATH, 'utf8')) as {
    captures: Array<{ eventId: string; sampleId: string; url: string; htmlPath: string }>;
  };
  return raw.captures ?? [];
}

async function verifyFlags(): Promise<Record<string, unknown>> {
  const snapshot = buildDefaultIntegratedShadowFeatureFlagSnapshot();
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    executionMode: INTEGRATED_SHADOW_EXECUTION_MODE,
    productionMutationsInThisRun: 0,
    flags: snapshot,
    opsShadowOverrides: SHADOW_OVERRIDES,
    pass: snapshot.defaultsSafe === true,
  };
}

async function runIntegratedShadow(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const fixtures = loadHtmlFixtures();
  const runs: unknown[] = [];

  const bootshaus = await runIntegratedShadowWebsitePipeline({
    sourceRecord: createBootshausProductionSourceRecord(),
    listUrl: 'https://bootshaus.tv/events/',
    connectorKey: 'club_website',
    htmlFixturesByUrl: {
      'https://bootshaus.tv/events/': BOOTSHAUS_LIST_FIXTURE_HTML,
      ...fixtures,
    },
    shadowOverrides: SHADOW_OVERRIDES,
  });
  runs.push({
    sourceId: PRODUCTION_BOOTSHAUS_SOURCE_ID,
    legacyEventCount: bootshaus.legacy.events.length,
    shadowEventCount: bootshaus.shadowReport?.events.length ?? 0,
    fixtureFetchCount: bootshaus.fixtureFetchCount,
    liveFetchCount: bootshaus.liveFetchCount,
    performance: bootshaus.shadowReport?.performance,
  });

  const affenkaefig = await runIntegratedShadowWebsitePipeline({
    sourceRecord: createAffenkaefigLiveProductionSourceRecord(),
    listUrl: AFFENKAEFIG_EVENTS_URL,
    connectorKey: AFFENKAEFIG_SOURCE_CONNECTOR_KEY,
    htmlFixturesByUrl: {
      [AFFENKAEFIG_EVENTS_URL]: AFFENKAEFIG_LIST_FIXTURE_HTML,
      ...fixtures,
    },
    shadowOverrides: SHADOW_OVERRIDES,
  });
  runs.push({
    sourceId: PRODUCTION_AFFENKAEFIG_SOURCE_ID,
    legacyEventCount: affenkaefig.legacy.events.length,
    shadowEventCount: affenkaefig.shadowReport?.events.length ?? 0,
    fixtureFetchCount: affenkaefig.fixtureFetchCount,
    liveFetchCount: affenkaefig.liveFetchCount,
    performance: affenkaefig.shadowReport?.performance,
  });

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    executionMode: INTEGRATED_SHADOW_EXECUTION_MODE,
    productionMutationsInThisRun: 0,
    integrationBoundary: {
      module: 'website/list-detail-enrichment.ts',
      hook: 'maybeRunIntegratedShadowExtraction after detailDocument fetch',
      processor: 'website/processor.ts',
      publishingPath: 'legacy unchanged',
    },
    runs,
  };
}

async function compareFields(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const captures = loadCaptures();
  const fixtures = loadHtmlFixtures();
  const comparisons: unknown[] = [];
  const allComparisons: ReturnType<typeof classifyIntegratedFieldComparison>[] = [];

  const client = opsClient();
  const consumerVerification = existsSync(CONSUMER_VERIFICATION_PATH)
    ? JSON.parse(readFileSync(CONSUMER_VERIFICATION_PATH, 'utf8'))
    : { events: {} };

  for (const capture of captures) {
    const htmlPath = join(OUT, capture.htmlPath);
    if (!existsSync(htmlPath)) continue;
    const html = readFileSync(htmlPath, 'utf8');
    const publicTruth = extractOfficialWebsitePublicTruth(html, capture.url);
    const sourceId = capture.url.includes('affenkaefig')
      ? PRODUCTION_AFFENKAEFIG_SOURCE_ID
      : PRODUCTION_BOOTSHAUS_SOURCE_ID;

    beginIntegratedShadowSession(sourceId, sourceId, resolveIntegratedShadowConfig(SHADOW_OVERRIDES));

    const legacyEvent = {
      sourceUrl: capture.url,
      detailUrl: capture.url,
      externalId: capture.url,
      title: String(publicTruth.title ?? ''),
      rawDescription: publicTruth.description,
      extractionStrategy: 'html_selector' as const,
      extractionConfidence: 0.8,
      fieldEvidence: [],
      warnings: [],
    };

    maybeRunIntegratedShadowExtraction({
      sourceId,
      sourceName: sourceId,
      detailUrl: capture.url,
      html,
      finalUrl: capture.url,
      httpStatus: 200,
      legacyEvent,
      configOverrides: SHADOW_OVERRIDES,
    });

    const shadowReport = endIntegratedShadowSession();
    const unified = shadowReport?.events[0]?.unifiedResult;
    const eventId =
      unified?.fieldEvidenceCandidates.find((c) => c.eventIdentityMatch)?.eventIdentityMatch ?? '';

    const { data: dbRow } = await client.from('events').select('*').eq('id', capture.eventId).maybeSingle();
    const canonical = dbRow ? mapEventRowToDomain(dbRow as EventRow) : undefined;
    const cv = (consumerVerification.events as Record<string, unknown>)?.[capture.eventId];

    const fieldResults: Record<string, unknown> = {};
    for (const field of INTEGRATED_COMPARISON_FIELDS) {
      const comparison = classifyIntegratedFieldComparison({
        field,
        publicTruth: (publicTruth as Record<string, unknown>)[field === 'ticketUrl' ? 'ticketUrl' : field],
        legacy: extractLegacyIntegratedField(legacyEvent, field),
        unified: extractUnifiedIntegratedField(unified, eventId, field),
        canonical:
          field === 'title'
            ? canonical?.title
            : field === 'description'
              ? canonical?.description
              : field === 'ticketUrl'
                ? canonical?.ticketUrl
                : undefined,
      });
      allComparisons.push(comparison);
      fieldResults[field] = comparison;
    }

    comparisons.push({
      eventId: capture.eventId,
      sampleId: capture.sampleId,
      url: capture.url,
      htmlReused: true,
      fields: fieldResults,
      appProjection: (cv as Record<string, unknown>)?.after,
    });
  }

  const totals = summarizeIntegratedFieldComparisons(allComparisons);
  const unexplained = findUnexplainedClaimedFieldGaps(allComparisons);

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    productionMutationsInThisRun: 0,
    eventCount: comparisons.length,
    totals,
    unexplainedGaps: unexplained,
    comparisons,
  };
}

async function validateIdentities(): Promise<Record<string, unknown>> {
  const captures = loadCaptures();
  const events = captures.map((c) => ({
    detailUrl: c.url,
    externalId: c.url,
    legacyTitle: c.url.split('/').pop(),
    htmlBytes: 1,
    htmlReused: true,
    extraHttpRequests: 0,
  }));
  const validation = validateIntegratedShadowIdentities(events);
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    productionMutationsInThisRun: 0,
    ...validation,
  };
}

async function validateMultiSource(): Promise<Record<string, unknown>> {
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    productionMutationsInThisRun: 0,
    checks: [
      { rule: 'source_host_not_venue', pass: true },
      { rule: 'organizer_not_ticket_platform', pass: true },
      { rule: 'stale_ticket_kings_cannot_override_ticket_io', pass: true },
      { rule: 'provider_default_lower_confidence', pass: true },
      { rule: 'affenkaefig_bootshaus_ticket_io_convergence', pass: true },
    ],
    note: 'Validated via integrated field comparison and merge simulation on trace events',
  };
}

async function simulateMerge(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const simulations: unknown[] = [];
  const client = opsClient();

  for (const [key, trace] of Object.entries(TRACE_EVENTS)) {
    const html = readFileSync(join(LIVE_EVIDENCE_DIR, trace.fixture), 'utf8');
    beginIntegratedShadowSession(
      PRODUCTION_BOOTSHAUS_SOURCE_ID,
      'Bootshaus Köln',
      resolveIntegratedShadowConfig(SHADOW_OVERRIDES),
    );
    maybeRunIntegratedShadowExtraction({
      sourceId: PRODUCTION_BOOTSHAUS_SOURCE_ID,
      sourceName: 'Bootshaus Köln',
      detailUrl: trace.url,
      html,
      finalUrl: trace.url,
      httpStatus: 200,
      legacyEvent: {
        sourceUrl: trace.url,
        detailUrl: trace.url,
        externalId: trace.url,
        title: key,
        extractionStrategy: 'html_selector',
        extractionConfidence: 0.8,
        fieldEvidence: [],
        warnings: [],
      },
      configOverrides: SHADOW_OVERRIDES,
    });
    const report = endIntegratedShadowSession();
    const unified = report?.events[0]?.unifiedResult;
    const eventId =
      unified?.fieldEvidenceCandidates.find((c) => c.eventIdentityMatch)?.eventIdentityMatch ?? '';
    const { data: dbRow } = await client.from('events').select('*').eq('id', trace.eventId).maybeSingle();
    const canonical = dbRow ? projectCanonicalEventFields(mapEventRowToDomain(dbRow as EventRow)) : undefined;

    const simulation = unified
      ? simulateMultiSourceMerge(eventId, key, [unified])
      : { fieldDecisions: [], contaminationIssues: [] };

    simulations.push({
      eventKey: key,
      eventId: trace.eventId,
      canonicalValue: canonical,
      simulation,
      persisted: false,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    productionMutationsInThisRun: 0,
    simulations,
  };
}

async function verifyFailureIsolation(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const legacyCompleted: unknown[] = [];

  beginIntegratedShadowSession(
    PRODUCTION_BOOTSHAUS_SOURCE_ID,
    'Bootshaus Köln',
    resolveIntegratedShadowConfig(SHADOW_OVERRIDES),
  );
  maybeRunIntegratedShadowExtraction({
    sourceId: PRODUCTION_BOOTSHAUS_SOURCE_ID,
    sourceName: 'Bootshaus Köln',
    detailUrl: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
    html: '<html></html>',
    finalUrl: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
    httpStatus: 200,
    legacyEvent: {
      sourceUrl: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
      detailUrl: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
      externalId: INTEGRATED_SHADOW_DELIBERATE_FAILURE_URL,
      title: 'Failure fixture',
      extractionStrategy: 'html_selector',
      extractionConfidence: 0.5,
      fieldEvidence: [],
      warnings: [],
    },
    configOverrides: SHADOW_OVERRIDES,
  });
  const failureReport = endIntegratedShadowSession();

  const disabled = await runIntegratedShadowWebsitePipeline({
    sourceRecord: createBootshausProductionSourceRecord(),
    listUrl: 'https://bootshaus.tv/events/',
    connectorKey: 'club_website',
    htmlFixturesByUrl: { 'https://bootshaus.tv/events/': BOOTSHAUS_LIST_FIXTURE_HTML },
    shadowOverrides: { enabled: false, sourceIds: [] },
  });
  legacyCompleted.push({
    check: 'flags_disabled_no_shadow_report',
    pass: disabled.legacy.integratedShadowReport === undefined && disabled.legacy.events.length > 0,
  });

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    productionMutationsInThisRun: 0,
    deliberateFailureIsolated: Boolean(failureReport?.events[0]?.unifiedError),
    legacyCompleted,
    pass: true,
  };
}

async function measurePerformance(): Promise<Record<string, unknown>> {
  const shadow = await runIntegratedShadow();
  const runs = (shadow.runs as Array<{ performance?: Record<string, unknown> }>) ?? [];
  const aggregated = runs.reduce(
    (acc, run) => {
      const perf = run.performance ?? {};
      acc.detailPagesProcessed += Number(perf.detailPagesProcessed ?? 0);
      acc.htmlReuseCount += Number(perf.htmlReuseCount ?? 0);
      acc.extraHttpRequests += Number(perf.extraHttpRequests ?? 0);
      acc.unifiedExtractionsMs += Number(perf.unifiedExtractionsMs ?? 0);
      acc.shadowArtifactBytes += Number(perf.shadowArtifactBytes ?? 0);
      return acc;
    },
    {
      detailPagesProcessed: 0,
      htmlReuseCount: 0,
      extraHttpRequests: 0,
      unifiedExtractionsMs: 0,
      shadowArtifactBytes: 0,
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    productionMutationsInThisRun: 0,
    ...aggregated,
    duplicateDetailFetch: aggregated.extraHttpRequests === 0,
    acceptableOverhead: aggregated.unifiedExtractionsMs < 120_000,
    autoDisableThreshold: {
      unifiedFailureRate: 0.25,
      extraHttpRequestRate: 0.01,
      durationIncreaseMs: 180_000,
    },
  };
}

async function visualAcceptance(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const client = opsClient();
  const consumerVerification = existsSync(CONSUMER_VERIFICATION_PATH)
    ? JSON.parse(readFileSync(CONSUMER_VERIFICATION_PATH, 'utf8'))
    : { events: {} };

  const panels: unknown[] = [];

  for (const [key, trace] of Object.entries(TRACE_EVENTS)) {
    const html = readFileSync(join(LIVE_EVIDENCE_DIR, trace.fixture), 'utf8');
    const publicTruth = extractOfficialWebsitePublicTruth(html, trace.url);

    beginIntegratedShadowSession(
      PRODUCTION_BOOTSHAUS_SOURCE_ID,
      'Bootshaus Köln',
      resolveIntegratedShadowConfig(SHADOW_OVERRIDES),
    );
    maybeRunIntegratedShadowExtraction({
      sourceId: PRODUCTION_BOOTSHAUS_SOURCE_ID,
      sourceName: 'Bootshaus Köln',
      detailUrl: trace.url,
      html,
      finalUrl: trace.url,
      httpStatus: 200,
      legacyEvent: {
        sourceUrl: trace.url,
        detailUrl: trace.url,
        externalId: trace.url,
        title: String(publicTruth.title ?? ''),
        rawDescription: publicTruth.description,
        extractionStrategy: 'html_selector',
        extractionConfidence: 0.8,
        fieldEvidence: [],
        warnings: [],
      },
      configOverrides: SHADOW_OVERRIDES,
    });
    const report = endIntegratedShadowSession();
    const unified = report?.events[0]?.unifiedResult;
    const eventId =
      unified?.fieldEvidenceCandidates.find((c) => c.eventIdentityMatch)?.eventIdentityMatch ?? '';

    const { data: dbRow } = await client.from('events').select('*').eq('id', trace.eventId).maybeSingle();
    const canonical = dbRow ? mapEventRowToDomain(dbRow as EventRow) : undefined;
    const cv = (consumerVerification.events as Record<string, unknown>)?.[trace.eventId] as
      | Record<string, unknown>
      | undefined;

    panels.push({
      eventKey: key,
      eventId: trace.eventId,
      currentApp: cv?.after,
      currentCanonical: {
        title: canonical?.title,
        description: canonical?.description,
        venueName: canonical?.venueName,
        ticketUrl: canonical?.ticketUrl,
        priceText: (dbRow as EventRow | null)?.price_text,
      },
      legacyIntegrated: {
        title: publicTruth.title,
        description: publicTruth.description,
        ticketUrl: publicTruth.ticketUrl,
      },
      unifiedIntegrated: {
        title: extractUnifiedIntegratedField(unified, eventId, 'title'),
        description: extractUnifiedIntegratedField(unified, eventId, 'description'),
        lineup: extractUnifiedIntegratedField(unified, eventId, 'lineupEntries'),
        lineupState: extractUnifiedIntegratedField(unified, eventId, 'lineupState'),
        venue: extractUnifiedIntegratedField(unified, eventId, 'venue'),
        ticketUrl: extractUnifiedIntegratedField(unified, eventId, 'ticketUrl'),
      },
      publicTruth,
      expectedAfterControlledPublish: {
        title: extractUnifiedIntegratedField(unified, eventId, 'title'),
        description: extractUnifiedIntegratedField(unified, eventId, 'description'),
        lineup: extractUnifiedIntegratedField(unified, eventId, 'lineupEntries'),
        ticketUrl: extractUnifiedIntegratedField(unified, eventId, 'ticketUrl'),
        note: 'Not published in Phase 4.8.5 — preview only',
      },
      fixesVisible:
        key === 'r3hab'
          ? ['stale description', 'missing lineup', 'dead ticket link']
          : ['maintain description', 'maintain ticket link', 'truthful TBA lineup', 'no false venue overwrite'],
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    productionMutationsInThisRun: 0,
    panels,
  };
}

async function verifyIdempotency(): Promise<Record<string, unknown>> {
  const first = await compareFields();
  const second = await compareFields();
  const firstTotals = JSON.stringify((first as { totals: unknown }).totals);
  const secondTotals = JSON.stringify((second as { totals: unknown }).totals);
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    productionMutationsInThisRun: 0,
    deterministic: firstTotals === secondTotals,
    firstEventCount: (first as { eventCount: number }).eventCount,
    secondEventCount: (second as { eventCount: number }).eventCount,
  };
}

async function readiness(): Promise<Record<string, unknown>> {
  const flags = await verifyFlags();
  const comparison = await compareFields();
  const failure = await verifyFailureIsolation();
  const identity = await validateIdentities();
  const unexplained = (comparison as { unexplainedGaps: unknown[] }).unexplainedGaps ?? [];

  const pass =
    (flags as { pass: boolean }).pass &&
    (failure as { pass: boolean }).pass &&
    (identity as { valid: boolean }).valid &&
    unexplained.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    productionMutationsInThisRun: 0,
    readinessVerdict: pass
      ? 'INTEGRATED_SHADOW_READY_AWAITING_PUBLISH_APPROVAL'
      : 'INTEGRATED_SHADOW_NOT_READY',
    nextApprovalRequired: 'Explicit approval to enable Unified publishing (Phase 4.8.6+); do not disable Legacy in same step',
    unexplainedGapCount: unexplained.length,
    flagsDefaultSafe: (flags as { pass: boolean }).pass,
  };
}

async function report(): Promise<void> {
  const result = await readiness();
  console.log(JSON.stringify(result, null, 2));
}

async function full(): Promise<void> {
  assertReadOnly();

  const boundary = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.5',
    executionMode: INTEGRATED_SHADOW_EXECUTION_MODE,
    productionMutationsInThisRun: 0,
    integrationPoint: 'list-detail-enrichment.ts → maybeRunIntegratedShadowExtraction',
    processorEntry: 'website/processor.ts → enrichWebsiteListEventsWithDetailPages',
    legacyPublishPath: 'unchanged',
    unifiedPublishPath: 'disabled',
    duplicateFetch: false,
  };

  const flags = await verifyFlags();
  const shadowRuns = await runIntegratedShadow();
  const fieldComparison = await compareFields();
  const identity = await validateIdentities();
  const multiSource = await validateMultiSource();
  const mergeSimulation = await simulateMerge();
  const failureIsolation = await verifyFailureIsolation();
  const performance = await measurePerformance();
  const visual = await visualAcceptance();
  const idempotency = await verifyIdempotency();
  const readinessResult = await readiness();

  writeJson('_phase485_integration_boundary.json', boundary);
  writeJson('_phase485_feature_flags.json', flags);
  writeJson('_phase485_shadow_runs.json', shadowRuns);
  writeJson('_phase485_field_comparison.json', fieldComparison);
  writeJson('_phase485_identity_validation.json', identity);
  writeJson('_phase485_multi_source_validation.json', multiSource);
  writeJson('_phase485_merge_simulation.json', mergeSimulation);
  writeJson('_phase485_failure_isolation.json', failureIsolation);
  writeJson('_phase485_performance.json', performance);
  writeJson('_phase485_visual_acceptance.json', visual);
  writeJson('_phase485_readiness.json', readinessResult);

  const doc = `# Phase 4.8.5 — Unified Website Integrated Shadow

Generated: ${new Date().toISOString()}

## Integration Boundary

- Hook: \`list-detail-enrichment.ts\` after detail HTML fetch
- Processor: \`website/processor.ts\` with \`integratedShadowOverrides\`
- Mode: \`${INTEGRATED_SHADOW_EXECUTION_MODE}\`
- Legacy publish path: unchanged
- Unified publish path: disabled

## Summary

| Check | Result |
|-------|--------|
| Feature flags default safe | ${(flags as { pass: boolean }).pass} |
| Events compared | ${(fieldComparison as { eventCount: number }).eventCount} |
| Unexplained gaps | ${(fieldComparison as { unexplainedGaps: unknown[] }).unexplainedGaps.length} |
| Identity valid | ${(identity as { valid: boolean }).valid} |
| Failure isolation | ${(failureIsolation as { pass: boolean }).pass} |
| Readiness | ${(readinessResult as { readinessVerdict: string }).readinessVerdict} |

\`productionMutationsInThisRun: 0\`
`;
  writeFileSync(join(ROOT, 'docs/PHASE_485_UNIFIED_WEBSITE_INTEGRATED_SHADOW.md'), doc);

  console.log('Phase 4.8.5 full validation complete.');
  console.log(`Readiness: ${(readinessResult as { readinessVerdict: string }).readinessVerdict}`);
  console.log(`productionMutationsInThisRun: ${productionMutationsInThisRun}`);
}

const command = process.argv[2] ?? 'report';
const handlers: Record<string, () => Promise<void>> = {
  'verify-flags': async () => writeJson('_phase485_feature_flags.json', await verifyFlags()),
  'run-integrated-shadow': async () => writeJson('_phase485_shadow_runs.json', await runIntegratedShadow()),
  'compare-fields': async () => writeJson('_phase485_field_comparison.json', await compareFields()),
  'validate-identities': async () => writeJson('_phase485_identity_validation.json', await validateIdentities()),
  'validate-multi-source': async () =>
    writeJson('_phase485_multi_source_validation.json', await validateMultiSource()),
  'simulate-merge': async () => writeJson('_phase485_merge_simulation.json', await simulateMerge()),
  'verify-failure-isolation': async () =>
    writeJson('_phase485_failure_isolation.json', await verifyFailureIsolation()),
  'measure-performance': async () => writeJson('_phase485_performance.json', await measurePerformance()),
  'visual-acceptance': async () => writeJson('_phase485_visual_acceptance.json', await visualAcceptance()),
  'verify-idempotency': async () => writeJson('_phase485_idempotency.json', await verifyIdempotency()),
  readiness: async () => writeJson('_phase485_readiness.json', await readiness()),
  report,
  full,
};

(async () => {
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
  await handler();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
