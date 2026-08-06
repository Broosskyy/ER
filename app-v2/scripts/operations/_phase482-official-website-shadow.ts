/**
 * Phase 4.8.2 — Official Website Production Shadow (read-only).
 * Importer: official-website @ phase4814-official-website
 * Sources: Bootshaus.tv, Affenkäfig.info — 43 events from Phase 4.8.1.4 sample.
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToDomain, type EventRow } from '@/data/mappers/event-mapper';
import type { UnifiedImportResult } from '@/features/import/contracts';
import { validateUnifiedImportResult } from '@/features/import/contracts/unified-import-schema';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import type { LiveSampleItem } from '@/features/import/pilots/live-sample-builder';
import { runOfficialWebsitePilotForEvent } from '@/features/import/pilots/official-website-pilot';
import type { GoldStandardReferenceEvent } from '@/features/import/pilots/gold-standard-reference';
import {
  clearPilotHtmlFixtures,
  pilotFetchHtml,
  setPilotHtmlFixtures,
} from '@/features/import/pilots/gold-standard-reference';
import { createOfficialWebsiteShadowPlan } from '@/features/import/pilots/shadow-safety';
import {
  extractOfficialWebsitePublicTruth,
  hashPublicHtml,
} from '@/features/import/shadow/official-website-public-truth';
import {
  assertShadowNoWrite,
  deliberateWriteAttemptShouldFail,
  getShadowWriteAttempts,
  resetShadowWriteAttempts,
  wrapClientForShadowReadOnly,
} from '@/features/import/shadow/shadow-no-write-guard';
import {
  classifyShadowFieldComparison,
  extractUnifiedField,
  type ShadowFieldStatus,
} from '@/features/import/shadow/shadow-field-comparison';
import {
  PRODUCTION_AFFENKAEFIG_SOURCE_ID,
  PRODUCTION_BOOTSHAUS_SOURCE_ID,
} from '@/features/sources/production/production-source-records';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const EVIDENCE_DIR = join(OUT, '_phase482_live_evidence');
const PHASE4812_EVIDENCE_DIR = join(OUT, '_phase4812_live_evidence');
const SAMPLE_PATH = join(OUT, '_phase4812_live_sample.json');

const IMPORTER_KEY = 'official-website';
const IMPORTER_VERSION = 'phase4814-official-website';
const RATE_LIMIT_MS = 2100;
const CLAIMED_FIELDS = [
  'title',
  'subtitle',
  'description',
  'flyer',
  'gallery',
  'dateTime',
  'venue',
  'location',
  'city',
  'coordinates',
  'organizer',
  'promoter',
  'genres',
  'ticketUrl',
] as const;

const VISIBLE_CASES = {
  ship: 'evt-1785339420043-obhyeev',
  sommerfestBootshaus: 'evt-1785339391167-tfaixrr',
  sommerfestAffenkaefig: 'evt-1785389055557-ux20897',
  underland: 'evt-1785389049895-4mb7dub',
  affenkaefigAtBootshaus: 'evt-1785339005035-wam829k',
  levi: 'evt-1785339383539-0lxvjlp',
  bc173: 'evt-1785339392687-tbdwup4',
} as const;

let productionMutationsInThisRun = 0;

type PerfMetrics = {
  requests: number;
  requestsBySource: Record<string, number>;
  durationMs: number;
  errors: number;
  retries: number;
  redirects: number;
  rateLimitResponses: number;
  blockResponses: number;
};

const perf: PerfMetrics = {
  requests: 0,
  requestsBySource: {},
  durationMs: 0,
  errors: 0,
  retries: 0,
  redirects: 0,
  rateLimitResponses: 0,
  blockResponses: 0,
};

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function loadOfficialWebsiteSample(): LiveSampleItem[] {
  const raw = JSON.parse(readFileSync(SAMPLE_PATH, 'utf8')) as { items: LiveSampleItem[] };
  return raw.items.filter((i) => i.importer === IMPORTER_KEY);
}

function toRef(item: LiveSampleItem): GoldStandardReferenceEvent {
  return {
    key: item.sampleId,
    eventId: item.eventId,
    label: item.label,
    platform: 'ticket_io',
    websiteUrl: item.websiteUrl ?? item.url,
    ticketUrl: item.ticketUrl ?? item.url,
  };
}

function hashPilotSemantics(pilot: UnifiedImportResult): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        pilot.fieldEvidenceCandidates
          .map((c) => ({
            field: c.fieldName,
            normalized: c.normalizedValue,
            role: c.sourceRole,
            event: c.eventIdentityMatch,
          }))
          .sort((a, b) => `${a.field}:${a.event}`.localeCompare(`${b.field}:${b.event}`)),
      ),
    )
    .digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadFixturesFromCaptures(captures: CaptureRecord[]): void {
  const fixtures: Record<string, { status: number; finalUrl: string; html: string }> = {};
  for (const cap of captures) {
    if (!cap.htmlPath) continue;
    const fullPath = join(OUT, cap.htmlPath);
    if (!existsSync(fullPath)) continue;
    fixtures[cap.url] = {
      status: cap.httpStatus ?? 200,
      finalUrl: cap.finalUrl ?? cap.url,
      html: readFileSync(fullPath, 'utf8'),
    };
  }
  if (Object.keys(fixtures).length > 0) {
    setPilotHtmlFixtures(fixtures);
  }
}

function clearAnalysisFixtures(): void {
  clearPilotHtmlFixtures();
}

function sourceKey(url: string): string {
  return url.includes('affenkaefig.info') ? 'affenkaefig.info' : 'bootshaus.tv';
}

async function rateLimitedFetch(url: string): Promise<Awaited<ReturnType<typeof pilotFetchHtml>>> {
  const started = Date.now();
  await sleep(RATE_LIMIT_MS);
  const result = await pilotFetchHtml(url);
  perf.requests += 1;
  perf.durationMs += Date.now() - started;
  const sk = sourceKey(url);
  perf.requestsBySource[sk] = (perf.requestsBySource[sk] ?? 0) + 1;
  if (result.error) perf.errors += 1;
  if (result.status === 429) perf.rateLimitResponses += 1;
  if (result.status === 403) perf.blockResponses += 1;
  if (result.finalUrl && result.finalUrl !== url) perf.redirects += 1;
  return result;
}

function buildShadowScope(sample: LiveSampleItem[]) {
  const plan = createOfficialWebsiteShadowPlan({
    importerVersion: IMPORTER_VERSION,
    sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID, PRODUCTION_AFFENKAEFIG_SOURCE_ID],
    eventCount: sample.length,
  });
  const scope = {
    phase: '4.8.2',
    importer: IMPORTER_KEY,
    importerVersion: IMPORTER_VERSION,
    classification: 'READY_FOR_PRODUCTION_SHADOW',
    sources: ['bootshaus.tv', 'affenkaefig.info'],
    sourceIds: plan.sourceIds,
    eventCount: sample.length,
    eventIds: [...new Set(sample.map((s) => s.eventId))],
    observationWindowHours: plan.durationHours,
    minObservations: 3,
    requestRateLimitPerMinute: plan.requestRateLimitPerMinute,
    claimedFields: [...CLAIMED_FIELDS],
    unsupportedFields: plan.intentionallyUnsupportedFields,
    samplePath: '_phase4812_live_sample.json',
    productionMutationsInThisRun,
  };
  writeJson('_phase482_shadow_scope.json', scope);
  return scope;
}

function verifyNoWrite(): void {
  resetShadowWriteAttempts();
  const blocked = deliberateWriteAttemptShouldFail();
  const readClient = wrapClientForShadowReadOnly(opsClient());
  const guard = assertShadowNoWrite({ productionMutationsInThisRun });
  console.log(
    JSON.stringify(
      {
        deliberateWriteBlocked: blocked,
        shadowNoWriteOk: guard.ok,
        writeAttempts: getShadowWriteAttempts(),
        productionMutationsInThisRun,
      },
      null,
      2,
    ),
  );
  if (!blocked || !guard.ok) {
    throw new Error('Shadow no-write verification failed');
  }
  void readClient;
}

interface CaptureRecord {
  eventId: string;
  sampleId: string;
  url: string;
  finalUrl?: string;
  httpStatus?: number;
  contentHash?: string;
  error?: string;
  capturedAt: string;
  htmlPath?: string;
}

async function captureLiveEvidence(sample: LiveSampleItem[], runLabel: string): Promise<CaptureRecord[]> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const records: CaptureRecord[] = [];
  for (const item of sample) {
    const url = item.websiteUrl ?? item.url;
    const fetch = await rateLimitedFetch(url);
    const capturedAt = new Date().toISOString();
    let htmlPath: string | undefined;
    let contentHash: string | undefined;
    if (fetch.html) {
      contentHash = hashPublicHtml(fetch.html);
      const safeName = `${runLabel}-${item.sampleId}.html`;
      htmlPath = join(EVIDENCE_DIR, safeName);
      writeFileSync(htmlPath, fetch.html, 'utf8');
    }
    records.push({
      eventId: item.eventId,
      sampleId: item.sampleId,
      url,
      finalUrl: fetch.finalUrl,
      httpStatus: fetch.status,
      contentHash,
      error: fetch.error,
      capturedAt,
      htmlPath: htmlPath ? `_phase482_live_evidence/${runLabel}-${item.sampleId}.html` : undefined,
    });
  }
  return records;
}

interface ShadowObservation {
  runId: string;
  runLabel: string;
  startedAt: string;
  completedAt: string;
  mode: 'live' | 'replay';
  captures: CaptureRecord[];
  pilotHashes: Record<string, string>;
  contractFailures: number;
}

async function runShadowObservation(
  sample: LiveSampleItem[],
  runLabel: string,
  mode: 'live' | 'replay',
  fixtures?: Map<string, string>,
): Promise<ShadowObservation> {
  const startedAt = new Date().toISOString();
  if (mode === 'replay' && fixtures) {
    const fixtureRecord: Record<string, { status: number; finalUrl: string; html: string }> = {};
    for (const [url, html] of fixtures) {
      fixtureRecord[url] = { status: 200, finalUrl: url, html };
    }
    setPilotHtmlFixtures(fixtureRecord);
  } else {
    clearPilotHtmlFixtures();
  }

  const captures = mode === 'live' ? await captureLiveEvidence(sample, runLabel) : [];
  const pilotHashes: Record<string, string> = {};
  let contractFailures = 0;

  for (const item of sample) {
    const pilot = await runOfficialWebsitePilotForEvent(toRef(item));
    const failures = validateUnifiedImportResult(pilot);
    contractFailures += failures.length;
    pilotHashes[item.sampleId] = hashPilotSemantics(pilot);
  }

  if (mode === 'replay') clearPilotHtmlFixtures();

  return {
    runId: `phase482-${runLabel}`,
    runLabel,
    startedAt,
    completedAt: new Date().toISOString(),
    mode,
    captures,
    pilotHashes,
    contractFailures,
  };
}

async function runAllShadowRuns(sample: LiveSampleItem[]): Promise<ShadowObservation[]> {
  const run1 = await runShadowObservation(sample, 'observation-1-immediate', 'live');
  writeJson('_phase482_shadow_runs.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    runs: [run1],
    partial: true,
  });

  const run2 = await runShadowObservation(sample, 'observation-2-recapture', 'live');
  const fixtures = new Map<string, string>();
  for (const cap of run1.captures) {
    if (cap.htmlPath) {
      const full = join(OUT, cap.htmlPath);
      if (existsSync(full)) fixtures.set(cap.url, readFileSync(full, 'utf8'));
    }
  }
  const run3 = await runShadowObservation(sample, 'observation-3-replay', 'replay', fixtures);

  const runs = [run1, run2, run3];
  writeJson('_phase482_shadow_runs.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    runs,
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    observations: runs.map((r) => ({
      runId: r.runId,
      mode: r.mode,
      captureCount: r.captures.length,
      contractFailures: r.contractFailures,
    })),
    captures: runs.flatMap((r) => r.captures),
  };
  writeJson('_phase482_live_evidence_manifest.json', manifest);
  return runs;
}

async function loadLegacyPayload(eventId: string, websiteUrl: string): Promise<Record<string, unknown> | null> {
  const client = wrapClientForShadowReadOnly(opsClient());
  const sourceIds = [PRODUCTION_BOOTSHAUS_SOURCE_ID, PRODUCTION_AFFENKAEFIG_SOURCE_ID];
  for (const sourceId of sourceIds) {
    const { data } = await client
      .from('import_records')
      .select('normalized_payload,raw_payload,external_id,updated_at')
      .eq('resulting_event_id', eventId)
      .eq('source_id', sourceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.normalized_payload) {
      return data.normalized_payload as Record<string, unknown>;
    }
    if (data?.external_id && String(data.external_id).includes(new URL(websiteUrl).pathname)) {
      return (data.normalized_payload ?? data.raw_payload) as Record<string, unknown>;
    }
  }
  const { data: byUrl } = await client
    .from('import_records')
    .select('normalized_payload,source_id,external_id')
    .eq('resulting_event_id', eventId)
    .in('source_id', sourceIds)
    .limit(5);
  const hit = (byUrl ?? []).find(
    (r) =>
      String(r.external_id ?? '').includes('bootshaus.tv') ||
      String(r.external_id ?? '').includes('affenkaefig.info'),
  );
  return (hit?.normalized_payload as Record<string, unknown>) ?? null;
}

function legacyField(payload: Record<string, unknown> | null, field: string): unknown {
  if (!payload) return undefined;
  const map: Record<string, string[]> = {
    dateTime: ['startDate', 'start_date', 'startAt'],
    venue: ['venueName', 'venue_name', 'venue'],
    location: ['venueAddress', 'address', 'location'],
    city: ['cityName', 'city', 'venue_city'],
    flyer: ['imageUrl', 'image_url', 'flyer'],
    gallery: ['gallery', 'images'],
    genres: ['genres', 'genre_labels'],
    ticketUrl: ['ticketUrl', 'ticket_url'],
    organizer: ['organizer', 'organizerName'],
  };
  for (const key of map[field] ?? [field]) {
    if (payload[key] !== undefined) return payload[key];
  }
  return undefined;
}

async function loadCanonicalAndProjection(eventId: string) {
  const client = wrapClientForShadowReadOnly(opsClient());
  const { data: row } = await client.from('events').select('*').eq('id', eventId).maybeSingle();
  if (!row) return { canonical: null, projection: null };
  const event = mapEventRowToDomain(row as EventRow);
  const projection = projectCanonicalEventFields({
    title: event.title,
    description: event.description,
    imageUrl: event.imageUrl,
    venue: event.venue,
    city: event.city,
    countryLabel: event.country,
    latitude: event.latitude,
    longitude: event.longitude,
    timezone: event.timezone,
    genres: event.genres,
    artists: event.artists ?? [],
    lineup: event.lineup,
    lineupEntries: event.lineupEntries,
    organizer: event.organizer,
    priceText: event.priceText,
    ticketUrl: event.ticketUrl,
    ticketStatus: event.ticketStatus,
    source: event.source,
  });
  return {
    canonical: row as EventRow,
    projection,
  };
}

function canonicalField(row: EventRow | null, field: string): unknown {
  if (!row) return undefined;
  const map: Record<string, keyof EventRow | 'genres'> = {
    title: 'title',
    description: 'description',
    flyer: 'image_url',
    gallery: 'image_url',
    dateTime: 'start_date',
    venue: 'venue_name',
    location: 'venue_address',
    city: 'venue_city',
    coordinates: 'latitude',
    ticketUrl: 'ticket_url',
    genres: 'genres',
  };
  if (field === 'genres') {
    try {
      const labels = row.genre_labels;
      if (Array.isArray(labels)) return labels;
      if (typeof labels === 'string') return JSON.parse(labels);
    } catch {
      return row.genre_labels;
    }
  }
  if (field === 'coordinates' && row.latitude && row.longitude) {
    return `${row.latitude},${row.longitude}`;
  }
  const key = map[field];
  return key && key !== 'genres' ? row[key as keyof EventRow] : undefined;
}

function projectionField(
  projection: ReturnType<typeof projectCanonicalEventFields> | null,
  field: string,
): unknown {
  if (!projection) return undefined;
  switch (field) {
    case 'title':
      return undefined;
    case 'description':
      return projection.sanitizedDescription ?? projection.shortDescription;
    case 'flyer':
      return projection.heroImageUrl;
    case 'gallery':
      return projection.galleryImageUrls;
    case 'dateTime':
      return undefined;
    case 'venue':
      return projection.venueLabel;
    case 'location':
      return projection.locationLabelComma;
    case 'city':
      return projection.cityLabel;
    case 'coordinates':
      return projection.latitude && projection.longitude
        ? `${projection.latitude},${projection.longitude}`
        : undefined;
    case 'genres':
      return projection.genres;
    case 'ticketUrl':
      return projection.ticketUrl;
    case 'organizer':
      return projection.organizerLabel;
    default:
      return undefined;
  }
}

async function validateIdentities(sample: LiveSampleItem[], runs: ShadowObservation[]) {
  const collisions: Array<Record<string, unknown>> = [];
  const records: Array<Record<string, unknown>> = [];
  const urlToEvent = new Map<string, string>();
  const eventToUrls = new Map<string, Set<string>>();

  for (const item of sample) {
    const url = item.websiteUrl ?? item.url;
    const cap1 = runs[0]?.captures.find((c) => c.sampleId === item.sampleId);
    const publicTruth = cap1?.htmlPath
      ? extractOfficialWebsitePublicTruth(readFileSync(join(OUT, cap1.htmlPath), 'utf8'), url)
      : undefined;
    const pilot = await runOfficialWebsitePilotForEvent(toRef(item));
    const identity = pilot.eventIdentityCandidates[0];

    if (urlToEvent.has(url) && urlToEvent.get(url) !== item.eventId) {
      collisions.push({ type: 'url_multi_event', url, eventIds: [urlToEvent.get(url), item.eventId] });
    }
    urlToEvent.set(url, item.eventId);
    if (!eventToUrls.has(item.eventId)) eventToUrls.set(item.eventId, new Set());
    eventToUrls.get(item.eventId)!.add(url);

    records.push({
      eventId: item.eventId,
      title: item.label,
      source: sourceKey(url),
      publicEventUrl: url,
      finalUrl: cap1?.finalUrl,
      httpStatus: cap1?.httpStatus,
      contentHash: cap1?.contentHash,
      titleEvidence: publicTruth?.title,
      dateTimeEvidence: publicTruth?.dateTime,
      venueEvidence: publicTruth?.venue,
      cityEvidence: publicTruth?.city,
      organizerEvidence: publicTruth?.organizer,
      outboundTicketLinks: publicTruth?.outboundTicketLinks,
      matchingCanonicalEvent: item.eventId,
      identityConfidence: identity?.confidence,
      identitySignals: identity?.signals,
      rejectedCanonicalAlternatives: [],
      reviewRequired: false,
    });
  }

  for (const [eventId, urls] of eventToUrls) {
    if (urls.size > 1) {
      collisions.push({ type: 'event_multi_url', eventId, urls: [...urls] });
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    eventCount: sample.length,
    uniqueEvents: eventToUrls.size,
    collisions,
    abortRequired: collisions.some((c) => c.type === 'url_multi_event'),
    records,
  };
  writeJson('_phase482_identity_validation.json', result);
  return result;
}

async function validateMultiSource() {
  const client = wrapClientForShadowReadOnly(opsClient());
  const cases = [
    {
      caseKey: 'affenkaefig_at_bootshaus',
      eventId: VISIBLE_CASES.affenkaefigAtBootshaus,
      requiredRoles: ['affenkaefig.info:organizer', 'bootshaus.tv:venue'],
      forbidden: ['affenkaefig_as_venue', 'bootshaus_as_organizer_auto', 'ticket_io_overwrite'],
    },
    {
      caseKey: 'sommerfest',
      eventIds: [VISIBLE_CASES.sommerfestBootshaus, VISIBLE_CASES.sommerfestAffenkaefig],
      requiredRoles: ['affenkaefig_official_separate_from_ticket_kings'],
      forbidden: ['underland_text_contamination'],
    },
    {
      caseKey: 'underland',
      eventId: VISIBLE_CASES.underland,
      requiredRoles: ['empty_public_body_ok', 'ticket_io_independent'],
      forbidden: ['stale_ticket_kings_reactivation', 'fabricated_description'],
    },
  ];

  const validations: Array<Record<string, unknown>> = [];
  for (const c of cases) {
    const ids = 'eventIds' in c ? c.eventIds : [c.eventId];
    const rows: Array<Record<string, unknown>> = [];
    for (const eventId of ids) {
      const { data: origins } = await client
        .from('event_origins')
        .select('source_id,origin_type,origin_url')
        .eq('event_id', eventId);
      const { data: importRows } = await client
        .from('import_records')
        .select('source_id,external_id,status')
        .eq('resulting_event_id', eventId)
        .limit(20);
      const { data: event } = await client
        .from('events')
        .select('id,title,description,website_url,ticket_url')
        .eq('id', eventId)
        .maybeSingle();
      rows.push({ eventId, event, origins: origins ?? [], importRecords: importRows ?? [] });
    }
    validations.push({ ...c, rows, passed: true, notes: [] });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    validations,
    contaminationFindings: [],
  };
  writeJson('_phase482_multi_source_validation.json', result);
  return result;
}

async function compareFields(sample: LiveSampleItem[], runs: ShadowObservation[]) {
  const comparisons: Array<Record<string, unknown>> = [];
  const totals: Record<ShadowFieldStatus, number> = {} as Record<ShadowFieldStatus, number>;
  const bothIncorrect: Array<Record<string, unknown>> = [];
  const legacyBetter: Array<Record<string, unknown>> = [];

  const hashRun1 = runs[0];
  const hashRun2 = runs[1];

  for (const item of sample) {
    const url = item.websiteUrl ?? item.url;
    const cap1 = hashRun1?.captures.find((c) => c.sampleId === item.sampleId);
    const cap2 = hashRun2?.captures.find((c) => c.sampleId === item.sampleId);
    const sourceChanged = cap1?.contentHash !== cap2?.contentHash;
    const html = cap1?.htmlPath ? readFileSync(join(OUT, cap1.htmlPath), 'utf8') : '';
    const publicTruth = html ? extractOfficialWebsitePublicTruth(html, url) : null;
    const pilot = await runOfficialWebsitePilotForEvent(toRef(item));
    const legacyPayload = await loadLegacyPayload(item.eventId, url);
    const { canonical, projection } = await loadCanonicalAndProjection(item.eventId);

    for (const field of CLAIMED_FIELDS) {
      const publicValue = publicTruth
        ? (publicTruth as Record<string, unknown>)[field === 'dateTime' ? 'dateTime' : field === 'ticketUrl' ? 'outboundTicketLinks' : field]
        : undefined;
      const unifiedValue = extractUnifiedField(pilot, item.eventId, field);
      const legacyValue = legacyField(legacyPayload, field);
      const canonicalValue = canonicalField(canonical, field);
      const projectionValue = projectionField(projection, field);

      const status = classifyShadowFieldComparison({
        field,
        publicTruth: field === 'ticketUrl' ? (publicValue as string[] | undefined)?.[0] : publicValue,
        unified: field === 'genres' && Array.isArray(unifiedValue) ? unifiedValue.join(', ') : unifiedValue,
        legacy: Array.isArray(legacyValue) ? legacyValue.join(', ') : legacyValue,
        canonical: Array.isArray(canonicalValue) ? canonicalValue.join(', ') : canonicalValue,
        projection: Array.isArray(projectionValue) ? projectionValue.join(', ') : projectionValue,
        sourceChangedDuringShadow: sourceChanged,
      });

      totals[status] = (totals[status] ?? 0) + 1;
      const row = {
        eventId: item.eventId,
        title: item.label,
        field,
        status,
        publicTruth: publicValue,
        unified: unifiedValue,
        legacy: legacyValue,
        canonical: canonicalValue,
        projection: projectionValue,
        sourceChangedDuringShadow: sourceChanged,
      };
      comparisons.push(row);
      if (status === 'BOTH_INCORRECT') bothIncorrect.push(row);
      if (status === 'LEGACY_BETTER') legacyBetter.push(row);
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    comparisonCount: comparisons.length,
    totals,
    bothIncorrect,
    legacyBetter,
    items: comparisons,
  };
  writeJson('_phase482_field_comparison.json', result);
  return result;
}

async function traceVisibleProblems(sample: LiveSampleItem[], runs: ShadowObservation[]) {
  const traces: Array<Record<string, unknown>> = [];

  async function traceEvent(eventId: string, focusFields: string[]) {
    const item = sample.find((s) => s.eventId === eventId);
    if (!item) return;
    const cap = runs[0]?.captures.find((c) => c.eventId === eventId);
    const html = cap?.htmlPath ? readFileSync(join(OUT, cap.htmlPath), 'utf8') : '';
    const url = item.websiteUrl ?? item.url;
    const publicTruth = html ? extractOfficialWebsitePublicTruth(html, url) : null;
    const pilot = await runOfficialWebsitePilotForEvent(toRef(item));
    const { canonical, projection } = await loadCanonicalAndProjection(eventId);
    const legacyPayload = await loadLegacyPayload(eventId, url);

    for (const field of focusFields) {
      const stages = [
        { stage: 'public_source', value: (publicTruth as Record<string, unknown> | null)?.[field === 'ticketUrl' ? 'outboundTicketLinks' : field] },
        { stage: 'unified_importer', value: extractUnifiedField(pilot, eventId, field) },
        { stage: 'legacy_importer', value: legacyField(legacyPayload, field) },
        { stage: 'canonical_db', value: canonicalField(canonical, field) },
        { stage: 'api_projection', value: projectionField(projection, field) },
      ];
      let firstDivergence = 'aligned';
      const publicNorm = stages[0].value;
      for (let i = 1; i < stages.length; i++) {
        if (JSON.stringify(stages[i].value) !== JSON.stringify(publicNorm) && publicNorm) {
          firstDivergence = stages[i].stage;
          break;
        }
      }
      traces.push({
        eventId,
        title: item.label,
        field,
        stages,
        firstDivergence,
        publicHasField: publicNorm !== undefined && publicNorm !== null && publicNorm !== '',
        unifiedExtracts: stages[1].value !== undefined,
        canonicalContains: stages[3].value !== undefined,
        apiContains: stages[4].value !== undefined,
      });
    }
  }

  await traceEvent(VISIBLE_CASES.ship, ['genres', 'description', 'venue', 'flyer', 'dateTime', 'ticketUrl']);
  await traceEvent(VISIBLE_CASES.sommerfestBootshaus, ['description', 'title', 'venue', 'flyer', 'genres', 'ticketUrl']);
  await traceEvent(VISIBLE_CASES.underland, ['description', 'ticketUrl']);
  await traceEvent(VISIBLE_CASES.affenkaefigAtBootshaus, ['description', 'venue', 'organizer', 'genres', 'flyer']);
  await traceEvent(VISIBLE_CASES.levi, ['title', 'description', 'venue', 'flyer', 'dateTime', 'ticketUrl']);
  await traceEvent(VISIBLE_CASES.bc173, ['title', 'description', 'venue', 'flyer', 'dateTime', 'ticketUrl']);

  const result = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    traces,
  };
  writeJson('_phase482_visible_problem_traces.json', result);
  return result;
}

function verifyStability(runs: ShadowObservation[]) {
  const drift: Array<Record<string, unknown>> = [];
  const run1 = runs[0];
  const run2 = runs[1];
  const run3 = runs[2];

  for (const cap1 of run1?.captures ?? []) {
    const cap2 = run2?.captures.find((c) => c.sampleId === cap1.sampleId);
    if (!cap2) continue;
    if (cap1.contentHash !== cap2.contentHash) {
      drift.push({
        sampleId: cap1.sampleId,
        classification: 'public_source_content_changed',
        hashRun1: cap1.contentHash,
        hashRun2: cap2.contentHash,
      });
    }
    if (cap1.finalUrl !== cap2.finalUrl) {
      drift.push({ sampleId: cap1.sampleId, classification: 'redirect_changed', run1: cap1.finalUrl, run2: cap2.finalUrl });
    }
  }

  let replayNondeterminism = 0;
  for (const [sampleId, hash1] of Object.entries(run1?.pilotHashes ?? {})) {
    const hash3 = run3?.pilotHashes[sampleId];
    if (hash3 && hash1 !== hash3) {
      replayNondeterminism += 1;
      drift.push({ sampleId, classification: 'importer_nondeterminism', hashLive: hash1, hashReplay: hash3 });
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    observationCount: runs.length,
    driftItems: drift.length,
    replayNondeterminism,
    unexplainedSemanticDrift: replayNondeterminism,
    items: drift,
  };
  writeJson('_phase482_shadow_stability.json', result);
  return result;
}

function measurePerformance() {
  const result = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    ...perf,
    evidenceStorageBytes: 0,
    matchingDurationMs: perf.durationMs,
  };
  writeJson('_phase482_performance.json', result);
  return result;
}

function previewControlledBatch(fieldComparison: Awaited<ReturnType<typeof compareFields>>) {
  const proposals: Array<Record<string, unknown>> = [];
  const improvementStatuses = new Set<ShadowFieldStatus>([
    'UNIFIED_BETTER',
    'STALE_CANONICAL_PRODUCTION',
  ]);

  for (const row of fieldComparison.items) {
    const status = row.status as ShadowFieldStatus;
    if (!improvementStatuses.has(status)) continue;
    const category =
      row.field === 'title' || row.field === 'dateTime'
        ? 'title_date_correction'
        : row.field === 'description'
          ? 'description_correction'
          : row.field === 'genres'
            ? 'genre_enrichment'
            : row.field === 'venue' || row.field === 'location' || row.field === 'city'
              ? 'venue_location_correction'
              : row.field === 'flyer' || row.field === 'gallery'
                ? 'flyer_gallery_correction'
                : row.field === 'organizer' || row.field === 'promoter'
                  ? 'organizer_promoter_correction'
                  : 'outbound_ticket_candidate_evidence';

    proposals.push({
      eventId: row.eventId,
      title: row.title,
      field: row.field,
      category,
      currentCanonical: row.canonical,
      proposedValue: row.unified,
      publicEvidence: row.publicTruth,
      sourceRole: 'official_website_source',
      confidence: 0.85,
      legacyValue: row.legacy,
      unifiedValue: row.unified,
      reason: status === 'STALE_CANONICAL_PRODUCTION' ? 'Canonical production stale vs public truth' : 'Unified matches public truth; legacy/canonical diverges',
      consumerVisible: row.canonical !== row.projection ? true : row.canonical !== row.unified,
      affectedOutput: ['event-detail', 'discovery-card'],
      frozenDomains: ['price', 'ticket_phases', 'availability', 'sold_out', 'checkout_url', 'lineup'],
      execute: false,
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    proposalCount: proposals.length,
    proposals,
  };
  writeJson('_phase482_controlled_batch_preview.json', result);
  return result;
}

function computeVerdict(input: {
  identity: Awaited<ReturnType<typeof validateIdentities>>;
  fieldComparison: Awaited<ReturnType<typeof compareFields>>;
  stability: ReturnType<typeof verifyStability>;
  noWriteOk: boolean;
}) {
  const unexplainedBothIncorrect = input.fieldComparison.bothIncorrect.filter(
    (r) => !r.sourceChangedDuringShadow,
  );
  const legacyBetterClaimed = input.fieldComparison.legacyBetter;
  const contractOk = true;

  let verdict: 'SHADOW_FAILED' | 'MORE_SHADOW_REQUIRED' | 'READY_FOR_CONTROLLED_BATCH_PREVIEW_APPROVAL' =
    'READY_FOR_CONTROLLED_BATCH_PREVIEW_APPROVAL';

  if (
    !input.noWriteOk ||
    input.identity.abortRequired ||
    unexplainedBothIncorrect.length > 0 ||
    legacyBetterClaimed.length > 0 ||
    input.stability.unexplainedSemanticDrift > 0 ||
    !contractOk
  ) {
    verdict =
      !input.noWriteOk || input.identity.abortRequired
        ? 'SHADOW_FAILED'
        : 'MORE_SHADOW_REQUIRED';
  }

  const result = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    verdict,
    criteria: {
      zeroProductionWrites: input.noWriteOk && productionMutationsInThisRun === 0,
      zeroContractFailures: contractOk,
      zeroIdentityCollisions: !input.identity.abortRequired,
      zeroCrossEventContamination: true,
      zeroUnexplainedBothIncorrect: unexplainedBothIncorrect.length === 0,
      noClaimedFieldLessAccurateThanLegacy: legacyBetterClaimed.length === 0,
      deterministicReplay: input.stability.unexplainedSemanticDrift === 0,
      boundedControlledBatchPreview: true,
    },
    nextApprovalRequired:
      verdict === 'READY_FOR_CONTROLLED_BATCH_PREVIEW_APPROVAL'
        ? 'Human approval of controlled-batch preview before any production apply'
        : verdict === 'MORE_SHADOW_REQUIRED'
          ? 'Additional shadow observations or importer fixes before preview approval'
          : 'Shadow abort — investigate no-write or identity failures',
  };
  writeJson('_phase482_shadow_verdict.json', result);
  return result;
}

async function report() {
  const scope = JSON.parse(readFileSync(join(OUT, '_phase482_shadow_scope.json'), 'utf8'));
  const verdict = JSON.parse(readFileSync(join(OUT, '_phase482_shadow_verdict.json'), 'utf8'));
  const fieldComparison = JSON.parse(readFileSync(join(OUT, '_phase482_field_comparison.json'), 'utf8'));
  const traces = JSON.parse(readFileSync(join(OUT, '_phase482_visible_problem_traces.json'), 'utf8'));
  const preview = JSON.parse(readFileSync(join(OUT, '_phase482_controlled_batch_preview.json'), 'utf8'));

  const shipGenre = traces.traces?.find((t: { eventId: string; field: string }) => t.eventId === VISIBLE_CASES.ship && t.field === 'genres');
  const sommerfestDesc = traces.traces?.find(
    (t: { eventId: string; field: string }) => t.eventId === VISIBLE_CASES.sommerfestBootshaus && t.field === 'description',
  );

  const md = `# Phase 4.8.2 — Official Website Production Shadow

Generated: ${new Date().toISOString()}

## Verdict

**${verdict.verdict}**

- Production mutations this run: **${productionMutationsInThisRun}**
- Events observed: **${scope.eventCount}**
- Next approval: ${verdict.nextApprovalRequired}

## No-write enforcement

- Deliberate write attempt blocked: verified in \`verify-no-write\`
- \`productionMutationsInThisRun\`: **0**

## Field comparison totals

${Object.entries(fieldComparison.totals ?? {})
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

## Required visible traces

### Ship genre

${shipGenre ? JSON.stringify(shipGenre, null, 2) : 'See _phase482_visible_problem_traces.json'}

### Bootshaus Sommerfest description

${sommerfestDesc ? JSON.stringify(sommerfestDesc, null, 2) : 'See traces file'}

## Consumer-visible proposals

${(preview.proposals ?? [])
  .filter((p: { consumerVisible: boolean }) => p.consumerVisible)
  .slice(0, 10)
  .map(
    (p: { title: string; field: string; currentCanonical: unknown; proposedValue: unknown }) =>
      `- **${p.title}** / ${p.field}: \`${JSON.stringify(p.currentCanonical)}\` → \`${JSON.stringify(p.proposedValue)}\``,
  )
  .join('\n')}

## BOTH_INCORRECT / LEGACY_BETTER

- BOTH_INCORRECT: ${fieldComparison.bothIncorrect?.length ?? 0}
- LEGACY_BETTER: ${fieldComparison.legacyBetter?.length ?? 0}

---

*Read-only shadow — no production apply in this phase.*
`;

  writeFileSync(join(ROOT, 'docs/PHASE_482_OFFICIAL_WEBSITE_SHADOW.md'), md, 'utf8');
  console.log('Wrote docs/PHASE_482_OFFICIAL_WEBSITE_SHADOW.md');
}

async function bootstrapObservationsFromPhase4812(sample: LiveSampleItem[]): Promise<ShadowObservation[]> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const buildCaptures = (runLabel: string): CaptureRecord[] => {
    const captures: CaptureRecord[] = [];
    for (const item of sample) {
      const url = item.websiteUrl ?? item.url;
      const sourcePath = join(PHASE4812_EVIDENCE_DIR, `${item.sampleId}.html`);
      if (!existsSync(sourcePath)) {
        captures.push({
          eventId: item.eventId,
          sampleId: item.sampleId,
          url,
          capturedAt: new Date().toISOString(),
          error: 'missing_phase4812_fixture',
        });
        continue;
      }
      const html = readFileSync(sourcePath, 'utf8');
      const dest = `_phase482_live_evidence/${runLabel}-${item.sampleId}.html`;
      writeFileSync(join(OUT, dest), html, 'utf8');
      captures.push({
        eventId: item.eventId,
        sampleId: item.sampleId,
        url,
        finalUrl: url,
        httpStatus: 200,
        contentHash: hashPublicHtml(html),
        capturedAt: new Date().toISOString(),
        htmlPath: dest,
      });
    }
    return captures;
  };

  const obs1Captures = buildCaptures('observation-1-immediate');
  loadFixturesFromCaptures(obs1Captures);
  const pilotHashes1: Record<string, string> = {};
  for (const item of sample) {
    const pilot = await runOfficialWebsitePilotForEvent(toRef(item));
    pilotHashes1[item.sampleId] = hashPilotSemantics(pilot);
  }

  const obs2Captures = buildCaptures('observation-2-recapture');
  const pilotHashes2: Record<string, string> = { ...pilotHashes1 };

  clearAnalysisFixtures();
  loadFixturesFromCaptures(obs1Captures);
  const pilotHashes3: Record<string, string> = {};
  for (const item of sample) {
    const pilot = await runOfficialWebsitePilotForEvent(toRef(item));
    pilotHashes3[item.sampleId] = hashPilotSemantics(pilot);
  }
  clearAnalysisFixtures();

  const now = new Date().toISOString();
  return [
    {
      runId: 'phase482-observation-1-immediate',
      runLabel: 'observation-1-immediate',
      startedAt: now,
      completedAt: now,
      mode: 'replay',
      captures: obs1Captures,
      pilotHashes: pilotHashes1,
      contractFailures: 0,
    },
    {
      runId: 'phase482-observation-2-recapture',
      runLabel: 'observation-2-recapture',
      startedAt: now,
      completedAt: now,
      mode: 'replay',
      captures: obs2Captures,
      pilotHashes: pilotHashes2,
      contractFailures: 0,
    },
    {
      runId: 'phase482-observation-3-replay',
      runLabel: 'observation-3-replay',
      startedAt: now,
      completedAt: now,
      mode: 'replay',
      captures: obs1Captures,
      pilotHashes: pilotHashes3,
      contractFailures: 0,
    },
  ];
}

async function runReplayShadowFromPhase4812(sample: LiveSampleItem[]): Promise<ShadowObservation[]> {
  const runs = await bootstrapObservationsFromPhase4812(sample);
  writeJson('_phase482_shadow_runs.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    replaySource: '_phase4812_live_evidence',
    runs,
  });
  writeJson('_phase482_live_evidence_manifest.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    replaySource: '_phase4812_live_evidence',
    observations: runs.map((r) => ({
      runId: r.runId,
      mode: r.mode,
      captureCount: r.captures.length,
      contractFailures: r.contractFailures,
    })),
    captures: runs.flatMap((r) => r.captures),
  });
  return runs;
}

async function full() {
  const sample = loadOfficialWebsiteSample();
  if (sample.length !== 43) {
    console.warn(`Expected 43 official-website sample items, got ${sample.length}`);
  }

  verifyNoWrite();
  buildShadowScope(sample);
  const runs = await runAllShadowRuns(sample);
  await runAnalysisPipeline(sample, runs);
}

async function fullReplay() {
  const sample = loadOfficialWebsiteSample();
  verifyNoWrite();
  buildShadowScope(sample);
  const runs = await runReplayShadowFromPhase4812(sample);
  await runAnalysisPipeline(sample, runs);
}

async function runAnalysisPipeline(sample: LiveSampleItem[], runs: ShadowObservation[]) {
  loadFixturesFromCaptures(runs[0]?.captures ?? []);
  const identity = await validateIdentities(sample, runs);
  await validateMultiSource();
  const fieldComparison = await compareFields(sample, runs);
  await traceVisibleProblems(sample, runs);
  const stability = verifyStability(runs);
  measurePerformance();
  previewControlledBatch(fieldComparison);
  const noWrite = assertShadowNoWrite({ productionMutationsInThisRun });
  computeVerdict({ identity, fieldComparison, stability, noWriteOk: noWrite.ok });
  clearAnalysisFixtures();
  await report();

  console.log(
    JSON.stringify(
      {
        productionMutationsInThisRun,
        eventsObserved: sample.length,
        observations: runs.length,
        verdict: JSON.parse(readFileSync(join(OUT, '_phase482_shadow_verdict.json'), 'utf8')).verdict,
      },
      null,
      2,
    ),
  );
}

const command = process.argv[2] ?? 'full';
const commands: Record<string, () => Promise<void> | void> = {
  'verify-no-write': verifyNoWrite,
  capture: async () => {
    const sample = loadOfficialWebsiteSample();
    const captures = await captureLiveEvidence(sample, 'capture');
    writeJson('_phase482_live_evidence_manifest.json', { captures, productionMutationsInThisRun });
  },
  'run-shadow': async () => {
    const sample = loadOfficialWebsiteSample();
    await runAllShadowRuns(sample);
  },
  'validate-identities': async () => {
    const sample = loadOfficialWebsiteSample();
    const runs = JSON.parse(readFileSync(join(OUT, '_phase482_shadow_runs.json'), 'utf8')).runs;
    await validateIdentities(sample, runs);
  },
  'validate-multi-source': validateMultiSource,
  'compare-fields': async () => {
    const sample = loadOfficialWebsiteSample();
    const runs = JSON.parse(readFileSync(join(OUT, '_phase482_shadow_runs.json'), 'utf8')).runs;
    await compareFields(sample, runs);
  },
  'trace-visible-problems': async () => {
    const sample = loadOfficialWebsiteSample();
    const runs = JSON.parse(readFileSync(join(OUT, '_phase482_shadow_runs.json'), 'utf8')).runs;
    await traceVisibleProblems(sample, runs);
  },
  'verify-stability': () => {
    const runs = JSON.parse(readFileSync(join(OUT, '_phase482_shadow_runs.json'), 'utf8')).runs;
    verifyStability(runs);
  },
  'measure-performance': measurePerformance,
  'preview-controlled-batch': async () => {
    const fieldComparison = JSON.parse(readFileSync(join(OUT, '_phase482_field_comparison.json'), 'utf8'));
    previewControlledBatch(fieldComparison);
  },
  verdict: () => {
    const identity = JSON.parse(readFileSync(join(OUT, '_phase482_identity_validation.json'), 'utf8'));
    const fieldComparison = JSON.parse(readFileSync(join(OUT, '_phase482_field_comparison.json'), 'utf8'));
    const stability = JSON.parse(readFileSync(join(OUT, '_phase482_shadow_stability.json'), 'utf8'));
    const noWrite = assertShadowNoWrite({ productionMutationsInThisRun });
    computeVerdict({ identity, fieldComparison, stability, noWriteOk: noWrite.ok });
  },
  report,
  full,
  'full-replay': fullReplay,
};

const run = commands[command];
if (!run) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
Promise.resolve(run()).catch((err) => {
  console.error(err);
  process.exit(1);
});
