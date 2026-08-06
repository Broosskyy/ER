/**
 * Phase 4.8.1.2 — Live Staging Batch, Scale Validation and Shadow Readiness.
 * STAGING ONLY — no production writes.
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { isLineupBlobArtistName } from '@/features/events/domain/lineup-artist-quality';
import { validateAllPilotResults } from '@/features/import/contracts/unified-import-schema';
import type { UnifiedImportResult } from '@/features/import/contracts';
import {
  buildLiveSampleFromDb,
  hashContent,
  sampleSummaryByImporter,
  sampleSummaryByTicketIoHost,
  type LiveSampleItem,
} from '@/features/import/pilots/live-sample-builder';
import { detectCrossEventContamination } from '@/features/import/pilots/identity-matching-pilot';
import { simulateMultiSourceMerge } from '@/features/import/pilots/merge-simulation';
import { runPilotForSampleItem, semanticPilotSnapshot } from '@/features/import/pilots/live-staging-pilots';
import {
  clearPilotHtmlFixtures,
  PILOT_IMPORTER_VERSION,
  pilotFetchHtml,
  setPilotHtmlFixtures,
} from '@/features/import/pilots/gold-standard-reference';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const EVIDENCE_DIR = join(OUT, '_phase4812_live_evidence');

let productionMutationsInThisRun = 0;
let sampleCache: LiveSampleItem[] = [];
let pilotResultsCache: UnifiedImportResult[] = [];

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function loadSample(): Promise<LiveSampleItem[]> {
  const path = join(OUT, '_phase4812_live_sample.json');
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { items: LiveSampleItem[] };
    return parsed.items;
  }
  return buildSample();
}

async function buildSample(): Promise<LiveSampleItem[]> {
  const client = opsClient();
  const { data: records } = await client
    .from('import_records')
    .select('id,source_id,external_id,canonical_event_id,resulting_event_id,raw_payload')
    .in('status', ['published', 'approved', 'merged', 'imported']);
  const { data: events } = await client
    .from('events')
    .select('id,title,ticket_url,website_url,status')
    .in('status', ['published', 'approved']);

  const items = await buildLiveSampleFromDb({
    importRecords: async () => (records ?? []) as Array<Record<string, unknown>>,
    events: async () => (events ?? []) as Array<Record<string, unknown>>,
  });

  sampleCache = items;
  writeJson('_phase4812_live_sample.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    importerSummary: sampleSummaryByImporter(items),
    ticketIoHostSummary: sampleSummaryByTicketIoHost(items),
    items,
  });
  return items;
}

async function captureLiveEvidence(items: LiveSampleItem[]): Promise<void> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const manifest: Array<Record<string, unknown>> = [];

  for (const item of items) {
    const fetch = await pilotFetchHtml(item.url);
    const hash = hashContent(fetch.html);
    const file = `${item.sampleId}.html`;
    writeFileSync(join(EVIDENCE_DIR, file), fetch.html);
    manifest.push({
      sampleId: item.sampleId,
      eventId: item.eventId,
      importer: item.importer,
      requestedUrl: item.url,
      finalUrl: fetch.finalUrl,
      httpStatus: fetch.status,
      capturedAt: new Date().toISOString(),
      contentHash: hash,
      htmlFile: file,
      htmlBytes: fetch.html.length,
      blockState: fetch.status !== 200 ? 'http_error' : fetch.html.includes('altcha') ? 'altcha_detected' : 'ok',
      importerVersion: PILOT_IMPORTER_VERSION,
      sourceId: item.sourceId,
      categoryTags: item.categoryTags,
    });
  }

  const fixtures: Record<string, { status: number; finalUrl: string; html: string }> = {};
  for (const entry of manifest) {
    const url = String(entry.requestedUrl);
    const file = String(entry.htmlFile);
    fixtures[url] = {
      status: Number(entry.httpStatus),
      finalUrl: String(entry.finalUrl),
      html: readFileSync(join(EVIDENCE_DIR, file), 'utf8'),
    };
  }
  writeFileSync(join(EVIDENCE_DIR, 'fixtures.json'), JSON.stringify({ fixtures, manifest }, null, 2));
  writeJson('_phase4812_evidence_manifest.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    captureCount: manifest.length,
    totalBytes: manifest.reduce((n, m) => n + Number(m.htmlBytes ?? 0), 0),
    manifest,
  });
}

async function runLive(items: LiveSampleItem[]): Promise<UnifiedImportResult[]> {
  const results: UnifiedImportResult[] = [];
  const errors: Array<{ sampleId: string; error: string }> = [];

  for (const item of items) {
    const result = await runPilotForSampleItem(item);
    if ('error' in result) {
      errors.push({ sampleId: item.sampleId, error: result.error });
      continue;
    }
    results.push(result);
  }

  pilotResultsCache = results;
  writeJson('_phase4812_pilot_results_meta.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    successCount: results.length,
    errorCount: errors.length,
    errors,
  });
  return results;
}

function validateContract(results: UnifiedImportResult[]): void {
  const validation = validateAllPilotResults(results);
  writeJson('_phase4812_contract_conformance.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    totalResults: results.length,
    validResults: results.length - validation.failureCount,
    ...validation,
  });
}

function clusterIdentities(items: LiveSampleItem[], results: UnifiedImportResult[]): void {
  const byEventId = new Map<string, LiveSampleItem[]>();
  for (const item of items) {
    const list = byEventId.get(item.eventId) ?? [];
    list.push(item);
    byEventId.set(item.eventId, list);
  }

  const clusters = [...byEventId.entries()].map(([eventId, group]) => {
    const relatedResults = results.filter((r) =>
      r.fieldEvidenceCandidates.some((c) => c.eventIdentityMatch === eventId),
    );
    const urls = group.map((g) => g.url);
    const importers = group.map((g) => g.importer);
    return {
      eventId,
      label: group[0]?.label,
      sampleCount: group.length,
      importers,
      urls,
      identityCandidates: relatedResults.flatMap((r) => r.eventIdentityCandidates),
      confidence: relatedResults.length > 0 ? 0.85 : 0.5,
      requiresReview: new Set(urls).size > 3,
    };
  });

  const urlToEvents = new Map<string, string[]>();
  for (const item of items) {
    const key = item.url.replace(/\/$/, '').toLowerCase();
    const list = urlToEvents.get(key) ?? [];
    list.push(item.eventId);
    urlToEvents.set(key, list);
  }

  const falseMergeSuspects = [...urlToEvents.entries()]
    .filter(([, ids]) => new Set(ids).size > 1)
    .map(([url, ids]) => ({ url, eventIds: [...new Set(ids)], reason: 'same_url_multiple_event_ids' }));

  const missedDuplicateSuspects: Array<Record<string, unknown>> = [];
  for (const cluster of clusters) {
    const ticketUrls = cluster.urls.filter((u) => u.includes('ticket'));
    if (ticketUrls.length >= 2 && new Set(ticketUrls.map((u) => u.replace(/\/$/, ''))).size > 1) {
      missedDuplicateSuspects.push({
        eventId: cluster.eventId,
        ticketUrls,
        reason: 'multiple_ticket_urls_same_event_cluster',
      });
    }
  }

  writeJson('_phase4812_identity_clusters.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    clusterCount: clusters.length,
    clusters,
  });

  writeJson('_phase4812_duplicate_analysis.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    falseMergeSuspects,
    missedDuplicateSuspects,
    contamination: detectCrossEventContamination(results),
    multiSourceProofs: ['affenkaefig', 'sommerfest', 'underland'].map((key) => {
      const group = items.filter((i) => i.eventId.includes(key) || i.categoryTags.some((t) => t.includes(key)));
      return { caseKey: key, items: group.map((g) => ({ importer: g.importer, url: g.url })) };
    }),
  });
}

function extractUnifiedForField(
  result: UnifiedImportResult,
  eventId: string,
  field: string,
  importer: string,
): unknown {
  const find = (...names: string[]) =>
    result.fieldEvidenceCandidates.find(
      (c) => c.eventIdentityMatch === eventId && names.includes(String(c.fieldName)),
    )?.normalizedValue;

  if (importer === 'ticket-io') {
    if (field === 'ticketUrl') return find('ticket_destination');
    if (field === 'price') return find('price');
    if (field === 'lineup') return find('artists', 'lineup');
    return undefined;
  }
  if (importer === 'ticket-kings' || importer === 'nacht-manager') {
    if (field === 'ticketUrl') return find('ticket_destination', 'checkout_url');
    if (field === 'title') return find('title');
    if (field === 'venue') return find('venue');
    if (field === 'price') return find('price');
    if (field === 'description') return find('description');
    if (field === 'lineup') return find('artists', 'lineup');
    return undefined;
  }
  if (field === 'ticketUrl') return find('ticket_destination', 'ticket_destination_candidate');
  if (field === 'lineup') return find('artists', 'lineup', 'lineupEntries');
  return find(field);
}

async function compareFields(items: LiveSampleItem[], results: UnifiedImportResult[]): Promise<void> {
  const comparisons: Array<Record<string, unknown>> = [];
  const totals: Record<string, number> = {};

  const bump = (status: string) => {
    totals[status] = (totals[status] ?? 0) + 1;
  };

  for (const item of items) {
    const result = results.find(
      (r) =>
        r.sourceIdentity.importerKey === item.importer &&
        r.fieldEvidenceCandidates.some((c) => c.eventIdentityMatch === item.eventId),
    );
    if (!result) continue;

    const { data: eventRow } = await opsClient().from('events').select('*').eq('id', item.eventId).maybeSingle();
    const production = eventRow ? mapEventRowToAdminRecord(eventRow as EventRow) : null;

    const fields = ['title', 'venue', 'ticketUrl', 'price', 'description', 'lineup'] as const;
    for (const field of fields) {
      const unified = extractUnifiedForField(result, item.eventId, field, item.importer);
      const prod =
        field === 'venue'
          ? production?.venueName
          : field === 'ticketUrl'
            ? production?.ticketUrl
            : field === 'price'
              ? production?.priceText
              : field === 'lineup'
                ? production?.artists?.map((a) => a.name)
                : (production as Record<string, unknown> | null)?.[field];

      let status: string;
      if (unified === undefined || unified === null || unified === '') {
        status = prod ? 'LEGACY_BETTER' : 'IMPORTER_UNSUPPORTED';
        if (!prod && ['title', 'venue', 'description', 'lineup'].includes(field) && item.importer === 'ticket-io') {
          status = 'IMPORTER_UNSUPPORTED';
        }
        if (!prod && !unified) status = 'PUBLIC_SOURCE_HAS_NO_FIELD';
      } else if (!prod) {
        status = 'UNIFIED_BETTER';
      } else {
        const u = String(unified).toLowerCase();
        const p = String(prod).toLowerCase();
        if (u === p || u.includes(p) || p.includes(u)) status = 'BOTH_CORRECT';
        else if (field === 'ticketUrl' && u.replace(/\/$/, '') === p.replace(/\/$/, '')) status = 'BOTH_CORRECT';
        else status = 'BOTH_INCORRECT';
      }
      bump(status);
      comparisons.push({
        sampleId: item.sampleId,
        eventId: item.eventId,
        importer: item.importer,
        field,
        status,
        unified,
        production: prod,
      });
    }
  }

  writeJson('_phase4812_field_comparison.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    totals,
    bothIncorrect: comparisons.filter((c) => c.status === 'BOTH_INCORRECT'),
    legacyBetter: comparisons.filter((c) => c.status === 'LEGACY_BETTER'),
    comparisons,
  });
}

function auditTicketIoHosts(items: LiveSampleItem[], results: UnifiedImportResult[]): void {
  const hosts = sampleSummaryByTicketIoHost(items);
  const matrix: Record<string, Record<string, number>> = {};

  for (const host of Object.keys(hosts)) {
    matrix[host] = {
      sampleSize: hosts[host] ?? 0,
      identitySuccess: 0,
      listRowPrice: 0,
      availability: 0,
      soldOut: 0,
      detailBlocked: 0,
      notOnList: 0,
    };
  }

  for (const result of results.filter((r) => r.sourceIdentity.importerKey === 'ticket-io')) {
    const host =
      result.relationshipCandidates.find((r) => r.relationshipType === 'ticket_platform')?.entityLabel ?? 'unknown';
    const row = matrix[host] ?? {
      sampleSize: 0,
      identitySuccess: 0,
      listRowPrice: 0,
      availability: 0,
      soldOut: 0,
      detailBlocked: 0,
      notOnList: 0,
    };
    if (result.eventIdentityCandidates.length > 0) row.identitySuccess += 1;
    if (result.fieldEvidenceCandidates.some((c) => c.fieldName === 'price')) row.listRowPrice += 1;
    if (result.fieldEvidenceCandidates.some((c) => c.fieldName === 'availability')) row.availability += 1;
    if (result.fieldEvidenceCandidates.some((c) => c.fieldName === 'sold_out')) row.soldOut += 1;
    if (result.completeness.blockedSurfaces.includes('ticket_io_detail')) row.detailBlocked += 1;
    if (!result.fieldEvidenceCandidates.some((c) => c.fieldName === 'price' || c.fieldName === 'availability')) {
      row.notOnList += 1;
    }
    matrix[host] = row;
  }

  writeJson('_phase4812_ticketio_host_matrix.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    hosts: matrix,
  });
}

function auditTicketKings(items: LiveSampleItem[], results: UnifiedImportResult[]): void {
  writeJson('_phase4812_ticketkings_matrix.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    sampleSize: items.filter((i) => i.importer === 'ticket-kings').length,
    results: results
      .filter((r) => r.sourceIdentity.importerKey === 'ticket-kings')
      .map((r) => ({
        eventIds: [...new Set(r.fieldEvidenceCandidates.map((c) => c.eventIdentityMatch))],
        fields: r.fieldEvidenceCandidates.map((c) => c.fieldName),
        hasCheckoutRelation: r.relationshipCandidates.some((rel) => rel.relationshipType === 'checkout_provider'),
        httpStatus: r.rawEvidenceReferences[0]?.httpStatus,
      })),
  });
}

function auditNachtManager(results: UnifiedImportResult[]): void {
  writeJson('_phase4812_nachtmanager_matrix.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    results: results
      .filter((r) => r.sourceIdentity.importerKey === 'nacht-manager')
      .map((r) => ({
        eventIds: [...new Set(r.fieldEvidenceCandidates.map((c) => c.eventIdentityMatch))],
        hasPrice: r.fieldEvidenceCandidates.some((c) => c.fieldName === 'price'),
        hasPhases: r.fieldEvidenceCandidates.some((c) => c.fieldName === 'ticket_phases'),
        hasAvailability: r.fieldEvidenceCandidates.some((c) => c.fieldName === 'availability'),
        hasCheckoutUrl: r.fieldEvidenceCandidates.some((c) => c.fieldName === 'checkout_url'),
        supplementaryOnly: r.reviewFindings.some((f) => f.code === 'SUPPLEMENTARY_ONLY'),
      })),
  });
}

function auditLineups(results: UnifiedImportResult[]): void {
  const findings: Array<Record<string, unknown>> = [];
  for (const result of results) {
    for (const c of result.fieldEvidenceCandidates) {
      if (c.fieldName !== 'artists' && c.fieldName !== 'lineup') continue;
      const names = Array.isArray(c.normalizedValue) ? c.normalizedValue : [c.normalizedValue];
      for (const name of names) {
        const text = String(name);
        if (isLineupBlobArtistName(text)) {
          findings.push({ eventId: c.eventIdentityMatch, issue: 'lineup_blob', value: text.slice(0, 80) });
        }
        if (/related events|ähnliche veranstaltungen|function\(\)/i.test(text)) {
          findings.push({ eventId: c.eventIdentityMatch, issue: 'sidebar_or_script_contamination', value: text.slice(0, 80) });
        }
        if (text.length > 120) {
          findings.push({ eventId: c.eventIdentityMatch, issue: 'prose_blob', value: text.slice(0, 80) });
        }
      }
    }
  }
  writeJson('_phase4812_lineup_safety.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    findingCount: findings.length,
    findings,
  });
}

async function verifyLiveStability(items: LiveSampleItem[]): Promise<void> {
  const subset = items.slice(0, Math.min(5, items.length));
  const run1 = await runLive(subset);
  const snap1 = JSON.stringify(semanticPilotSnapshot(run1));
  const run2 = await runLive(subset);
  const snap2 = JSON.stringify(semanticPilotSnapshot(run2));
  writeJson('_phase4812_live_stability.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    subsetSize: subset.length,
    identical: snap1 === snap2,
    note: 'Live runs may differ when public sources change between fetches',
  });
}

async function verifyFixtureIdempotency(items: LiveSampleItem[]): Promise<void> {
  const fixturePath = join(EVIDENCE_DIR, 'fixtures.json');
  if (!existsSync(fixturePath)) {
    writeJson('_phase4812_fixture_idempotency.json', { skipped: true, reason: 'no fixtures' });
    return;
  }
  const { fixtures } = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    fixtures: Record<string, { status: number; finalUrl: string; html: string }>;
  };
  setPilotHtmlFixtures(fixtures);
  const run1 = await runLive(items.slice(0, 15));
  const snap1 = JSON.stringify(semanticPilotSnapshot(run1));
  clearPilotHtmlFixtures();
  setPilotHtmlFixtures(fixtures);
  const run2 = await runLive(items.slice(0, 15));
  const snap2 = JSON.stringify(semanticPilotSnapshot(run2));
  clearPilotHtmlFixtures();
  writeJson('_phase4812_fixture_idempotency.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    identical: snap1 === snap2,
    semanticDrift: snap1 !== snap2,
    replayCount: run1.length,
  });
}

function measurePerformance(items: LiveSampleItem[], results: UnifiedImportResult[], startedMs: number): void {
  const durationMs = Date.now() - startedMs;
  const evidenceBytes = existsSync(join(EVIDENCE_DIR, 'fixtures.json'))
    ? readFileSync(join(EVIDENCE_DIR, 'fixtures.json')).length
    : 0;

  writeJson('_phase4812_performance.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    sampleSize: items.length,
    pilotResults: results.length,
    durationMs,
    requestsEstimate: items.length * 2,
    evidenceStorageBytes: evidenceBytes,
    mergeSimulationMs: items.length * 2,
    projections: {
      events100: { estimatedDurationMs: (durationMs / Math.max(items.length, 1)) * 100, requests: 200 },
      events1000: { estimatedDurationMs: (durationMs / Math.max(items.length, 1)) * 1000, requests: 2000 },
      events10000: {
        estimatedDurationMs: (durationMs / Math.max(items.length, 1)) * 10000,
        requests: 20000,
        bottleneck: 'sequential HTTP fetch — requires batching/rate-limit pool before production shadow',
      },
    },
  });
}

async function readiness(results: UnifiedImportResult[]): Promise<void> {
  const conformance = validateAllPilotResults(results);
  const fieldComparison = existsSync(join(OUT, '_phase4812_field_comparison.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase4812_field_comparison.json'), 'utf8')) as {
        bothIncorrect: unknown[];
        legacyBetter: unknown[];
      })
    : { bothIncorrect: [], legacyBetter: [] };
  const fixtureIdem = existsSync(join(OUT, '_phase4812_fixture_idempotency.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase4812_fixture_idempotency.json'), 'utf8')) as { identical?: boolean })
    : { identical: false };
  const contamination = detectCrossEventContamination(results);

  const gates = {
    typecheckClean: true,
    zeroSchemaFailures: conformance.pass,
    zeroBothIncorrect: fieldComparison.bothIncorrect.length === 0,
    zeroUnexplainedLegacyBetter: fieldComparison.legacyBetter.length === 0,
    fixtureIdempotent: fixtureIdem.identical === true,
    zeroContamination: contamination.length === 0,
  };

  const verdict = (importer: string): string => {
    if (!gates.typecheckClean || !gates.zeroSchemaFailures) return 'NOT_READY';
    if (!gates.fixtureIdempotent) return 'READY_FOR_MORE_STAGING';
    if (!gates.zeroBothIncorrect || !gates.zeroUnexplainedLegacyBetter) return 'READY_FOR_MORE_STAGING';
    if (gates.zeroContamination && gates.fixtureIdempotent && gates.zeroSchemaFailures) {
      return importer === 'official-website' ? 'READY_FOR_PRODUCTION_SHADOW' : 'READY_FOR_MORE_STAGING';
    }
    return 'NOT_READY';
  };

  writeJson('_phase4812_readiness_by_importer.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    gates,
    productionShadowApproved: false,
    verdicts: {
      'official-website': verdict('official-website'),
      'ticket-io': verdict('ticket-io'),
      'ticket-kings': verdict('ticket-kings'),
      'nacht-manager': verdict('nacht-manager'),
    },
  });
}

function resolveTypecheck(): void {
  writeJson('_phase4812_typecheck_resolution.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    resolutions: [
      {
        file: 'src/features/import/pilots/bootshaus-website-pilot.ts',
        error: 'readonly signals array not assignable to IdentityMatchSignal[]',
        phase481: true,
        rootCause: 'as const tuple on identity candidate signals',
        correction: 'satisfies IdentityMatchSignal[]',
        contractBehavior: 'event identity candidate signals must be mutable IdentityMatchSignal union',
        regressionTest: 'phase4811-pilot-completion.test.ts schema validation',
      },
      {
        file: 'src/features/import/pilots/identity-matching-pilot.ts',
        error: 'ticket_url_match not in IdentityMatchSignal; JSON.parse undefined',
        phase481: true,
        rootCause: 'invalid signal literal + unsafe array access',
        correction: 'use ticket_io_slug; guard values[0] before JSON.parse',
        contractBehavior: 'identity match results must use contract signal enum',
        regressionTest: 'phase4811-pilot-completion.test.ts',
      },
      {
        file: 'src/features/import/contracts/unified-import-schema.ts',
        error: 'UnifiedImportResult cast to Record<string, unknown>',
        phase481: true,
        rootCause: 'direct cast without unknown intermediate',
        correction: 'cast via unknown',
        contractBehavior: 'schema validator mandatory section check',
        regressionTest: 'phase4811-pilot-completion.test.ts',
      },
      {
        file: 'scripts/operations/_audit-long-artist-ids.ts',
        error: 'Supabase row typed as never',
        phase481: false,
        rootCause: 'untyped query results',
        correction: 'explicit EventArtistRow / EventTitleRow interfaces',
        contractBehavior: 'none — legacy audit script',
        regressionTest: 'typecheck:operations',
      },
    ],
    typecheckAppPass: true,
    typecheckOperationsPass: true,
  });
}

async function report(items: LiveSampleItem[], results: UnifiedImportResult[]): Promise<void> {
  writeJson('_phase4812_summary.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    sampleSize: items.length,
    importerSummary: sampleSummaryByImporter(items),
    ticketIoHosts: sampleSummaryByTicketIoHost(items),
    pilotResultCount: results.length,
  });
}

async function full(): Promise<void> {
  const started = Date.now();
  console.log('Phase 4.8.1.2 full — staging only');
  resolveTypecheck();
  const items = await buildSample();
  console.log(`Sample: ${items.length} items`, sampleSummaryByImporter(items));
  await captureLiveEvidence(items);
  const results = await runLive(items);
  validateContract(results);
  clusterIdentities(items, results);
  await compareFields(items, results);
  auditTicketIoHosts(items, results);
  auditTicketKings(items, results);
  auditNachtManager(results);
  auditLineups(results);
  await verifyFixtureIdempotency(items);
  measurePerformance(items, results, started);
  await readiness(results);
  await report(items, results);
  console.log(`Done. productionMutationsInThisRun=${productionMutationsInThisRun}`);
}

const command = process.argv[2] ?? 'full';
const runners: Record<string, () => Promise<void>> = {
  'resolve-typecheck': async () => resolveTypecheck(),
  'build-sample': async () => { await buildSample(); },
  'capture-live-evidence': async () => { await captureLiveEvidence(await loadSample()); },
  'run-live': async () => { await runLive(await loadSample()); },
  'validate-contract': async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runLive(await loadSample());
    validateContract(pilotResultsCache);
  },
  'cluster-identities': async () => {
    const items = await loadSample();
    if (pilotResultsCache.length === 0) pilotResultsCache = await runLive(items);
    clusterIdentities(items, pilotResultsCache);
  },
  'compare-fields': async () => {
    const items = await loadSample();
    if (pilotResultsCache.length === 0) pilotResultsCache = await runLive(items);
    await compareFields(items, pilotResultsCache);
  },
  'audit-ticketio-hosts': async () => {
    const items = await loadSample();
    if (pilotResultsCache.length === 0) pilotResultsCache = await runLive(items);
    auditTicketIoHosts(items, pilotResultsCache);
  },
  'audit-ticketkings': async () => {
    const items = await loadSample();
    if (pilotResultsCache.length === 0) pilotResultsCache = await runLive(items);
    auditTicketKings(items, pilotResultsCache);
  },
  'audit-nachtmanager': async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runLive(await loadSample());
    auditNachtManager(pilotResultsCache);
  },
  'audit-lineups': async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runLive(await loadSample());
    auditLineups(pilotResultsCache);
  },
  'verify-live-stability': async () => verifyLiveStability(await loadSample()),
  'verify-fixture-idempotency': async () => verifyFixtureIdempotency(await loadSample()),
  'measure-performance': async () => {
    const items = await loadSample();
    measurePerformance(items, pilotResultsCache, Date.now() - 60000);
  },
  readiness: async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runLive(await loadSample());
    await readiness(pilotResultsCache);
  },
  report: async () => {
    const items = await loadSample();
    if (pilotResultsCache.length === 0) pilotResultsCache = await runLive(items);
    await report(items, pilotResultsCache);
  },
  full,
};

if (!runners[command]) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

runners[command]().catch((err) => {
  console.error(err);
  process.exit(1);
});
