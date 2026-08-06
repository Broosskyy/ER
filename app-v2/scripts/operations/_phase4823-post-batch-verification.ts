/**
 * Phase 4.8.2.3 — Post-batch consumer verification and next Official Website batch preview.
 * Read-only — no production mutations.
 *
 * Usage:
 *   node --import tsx scripts/operations/_phase4823-post-batch-verification.ts verify-consumer
 *   node --import tsx scripts/operations/_phase4823-post-batch-verification.ts verify-regression
 *   node --import tsx scripts/operations/_phase4823-post-batch-verification.ts refresh-shadow
 *   node --import tsx scripts/operations/_phase4823-post-batch-verification.ts build-review-package
 *   node --import tsx scripts/operations/_phase4823-post-batch-verification.ts preview-next-batch
 *   node --import tsx scripts/operations/_phase4823-post-batch-verification.ts report
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, mapEventRowToDomain, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { readCanonicalLineup } from '@/features/events/domain/canonical-lineup-read';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { buildConsumerGalleryImageUrls } from '@/features/events/formatting/consumer-gallery-projection';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import type { LiveSampleItem } from '@/features/import/pilots/live-sample-builder';
import { runOfficialWebsitePilotForEvent } from '@/features/import/pilots/official-website-pilot';
import type { GoldStandardReferenceEvent } from '@/features/import/pilots/gold-standard-reference';
import { pilotFetchHtml } from '@/features/import/pilots/gold-standard-reference';
import {
  classifyAllProposals,
  elevateMissedProductionFixes,
  summarizeClassifications,
  toRealProductionFix,
  type ClassifiedProposal,
  type ControlledBatchProposal,
  type RealProductionFix,
} from '@/features/import/shadow/controlled-batch-review';
import {
  extractOfficialWebsitePublicTruth,
  hashPublicHtml,
  valuesSemanticallyEqual,
} from '@/features/import/shadow/official-website-public-truth';
import {
  buildForbiddenFingerprint,
  hashFingerprint,
  OFFICIAL_EVENT_URLS,
  projectConsumerEvent,
  R3HAB_EVENT_ID,
  SOMMERFEST_EVENT_ID,
} from '@/features/import/shadow/phase4822-controlled-batch';
import {
  assertShadowNoWrite,
  deliberateWriteAttemptShouldFail,
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
const REPORT = join(ROOT, 'docs/PHASE_4823_POST_BATCH_VERIFICATION.md');
const SAMPLE_PATH = join(OUT, '_phase4812_live_sample.json');
const EVIDENCE_DIR = join(OUT, '_phase4823_live_evidence');
const BACKUP_PATH = join(OUT, '_phase4822_backup.json');
const FORBIDDEN_BEFORE_PATH = join(OUT, '_phase4822_forbidden_fingerprints.json');
const BEFORE_AFTER_PATH = join(OUT, '_phase4822_before_after.json');

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

const EXPECTED_AFTER = {
  [SOMMERFEST_EVENT_ID]: {
    description:
      'Electro/EDM vs. Deep/TechHouse vs. Techno vs. DnB/Trap/Dubstep Lineup TBA',
    imageUrl:
      'https://s3.eu-central-1.amazonaws.com/cdn.pixend.de/CQYDNRZ9Q8QSS8D/events/19-04-04-14-8dbecd78eaba1d7771ad.jpeg',
  },
  [R3HAB_EVENT_ID]: {
    imageUrl:
      'https://s3.eu-central-1.amazonaws.com/cdn.pixend.de/CQYDNRZ9Q8QSS8D/events/6040282651513797069744665_0065463218711108022189235.png',
  },
} as const;

let productionMutationsInThisRun = 0;
const command = process.argv[2] ?? 'help';

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(OUT, name), 'utf8')) as T;
}

function verifyNoWrite(): void {
  resetShadowWriteAttempts();
  if (!deliberateWriteAttemptShouldFail()) {
    throw new Error('Deliberate write attempt was not blocked');
  }
  const guard = assertShadowNoWrite({ productionMutationsInThisRun });
  if (!guard.ok) {
    throw new Error(`No-write guard failed: ${guard.violations.join(', ')}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  await sleep(RATE_LIMIT_MS);
  const result = await pilotFetchHtml(url);
  if (result.error || !result.html) {
    throw new Error(result.error ?? `No HTML for ${url}`);
  }
  return result.html;
}

async function loadEvent(eventId: string): Promise<AdminEventRecord | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapEventRowToAdminRecord(data as EventRow) : null;
}

function buildViewModelLike(event: AdminEventRecord) {
  const projection = projectConsumerEvent(event);
  const gallery = buildConsumerGalleryImageUrls({
    flyerUrl: event.flyerUrl,
    imageUrl: event.imageUrl,
  });
  return {
    description: projection.sanitizedDescription ?? event.description,
    shortDescription: projection.shortDescription,
    heroImageUrl: projection.heroImageUrl ?? event.imageUrl,
    galleryImageUrls: gallery,
    title: event.title,
    venue: projection.venueLabel,
    city: projection.cityLabel,
    ticketUrl: projection.ticketUrl,
    displayPriceText: projection.displayPriceText,
    genres: projection.genres,
  };
}

async function loadFrozenDomains(eventId: string, event: AdminEventRecord) {
  const client = opsClient();
  const { data: structured } = await client
    .from('event_lineup_entries')
    .select('id,sort_order,billing_relation,event_lineup_entry_artists(artist_id,artists(name))')
    .eq('event_id', eventId);
  const { data: compat } = await client
    .from('event_artists')
    .select('artist_id,artists(name)')
    .eq('event_id', eventId);
  const lineup = readCanonicalLineup({
    structuredEntries: (structured ?? []).map((row) => ({
      id: String(row.id),
      order: row.sort_order ?? 0,
      billingRelation: row.billing_relation ?? 'SOLO',
      artists: ((row as { event_lineup_entry_artists?: Array<{ artists?: { name?: string } }> })
        .event_lineup_entry_artists ?? [])
        .map((a) => a.artists?.name ?? '')
        .filter(Boolean),
    })),
    compatibilityLineup: (compat ?? []).map((row) => ({
      artistId: String(row.artist_id),
      name: (row as { artists?: { name?: string } }).artists?.name ?? '',
    })),
    eventTitle: event.title,
  });
  const ticket = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  const { data: origins } = await client
    .from('event_origins')
    .select('source_id,origin_type,origin_url')
    .eq('event_id', eventId);
  return {
    lineup,
    ticket,
    origins: origins ?? [],
    genres: event.genreLabels ?? [],
    attributes: event.eventAttributes ?? null,
  };
}

async function verifyConsumer(): Promise<void> {
  verifyNoWrite();
  const backup = existsSync(BACKUP_PATH)
    ? readJson<{ events: Record<string, { description: string; image_url: string; apiProjection: Record<string, unknown> }> }>(
        '_phase4822_backup.json',
      )
    : null;
  const beforeAfter = existsSync(BEFORE_AFTER_PATH)
    ? readJson<{ events: Record<string, unknown> }>('_phase4822_before_after.json')
    : null;

  const events: Record<string, unknown> = {};

  for (const eventId of [SOMMERFEST_EVENT_ID, R3HAB_EVENT_ID]) {
    const event = await loadEvent(eventId);
    if (!event) throw new Error(`Missing event ${eventId}`);

    const officialUrl = OFFICIAL_EVENT_URLS[eventId] ?? '';
    const html = await fetchHtml(officialUrl);
    const publicTruth = extractOfficialWebsitePublicTruth(html, officialUrl);
    const db = {
      description: event.description,
      image_url: event.imageUrl,
      flyer_url: event.flyerUrl,
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      venueName: event.venueName,
      ticketUrl: event.ticketUrl,
      priceText: event.priceText,
    };
    const canonicalReader = mapEventRowToDomain(
      (await opsClient().from('events').select('*').eq('id', eventId).single()).data as EventRow,
    );
    const apiProjection = projectConsumerEvent(event);
    const viewModel = buildViewModelLike(event);
    const gallery = viewModel.galleryImageUrls;
    const frozen = await loadFrozenDomains(eventId, event);
    const expected = EXPECTED_AFTER[eventId as keyof typeof EXPECTED_AFTER];

    const checks: Record<string, boolean> = {};
    if (eventId === SOMMERFEST_EVENT_ID) {
      checks.descriptionMatchesOfficial = valuesSemanticallyEqual(
        apiProjection.sanitizedDescription,
        publicTruth.description,
      );
      checks.noUnderlandText = !String(apiProjection.sanitizedDescription ?? '')
        .toUpperCase()
        .includes('UNDERLAND');
      checks.flyerMatchesOfficial = viewModel.heroImageUrl === expected.imageUrl;
      checks.galleryUsesCorrectImage = gallery.includes(expected.imageUrl);
    } else {
      checks.flyerMatchesOfficial = viewModel.heroImageUrl === expected.imageUrl;
      checks.galleryUsesCorrectImage = gallery.includes(expected.imageUrl);
    }

    const layersAligned =
      valuesSemanticallyEqual(db.description, apiProjection.sanitizedDescription) &&
      valuesSemanticallyEqual(apiProjection.sanitizedDescription, viewModel.description) &&
      valuesSemanticallyEqual(apiProjection.heroImageUrl, viewModel.heroImageUrl);

    let divergenceCause: string | null = null;
    if (!layersAligned) {
      if (!valuesSemanticallyEqual(db.description, apiProjection.sanitizedDescription)) {
        divergenceCause = 'api_mismatch';
      } else if (!valuesSemanticallyEqual(apiProjection.sanitizedDescription, viewModel.description)) {
        divergenceCause = 'viewmodel_mismatch';
      } else if (apiProjection.heroImageUrl !== viewModel.heroImageUrl) {
        divergenceCause = 'viewmodel_mismatch';
      }
    }

    const backupRow = backup?.events[eventId];
    events[eventId] = {
      eventId,
      title: event.title,
      officialPublicEventUrl: officialUrl,
      publicEvidence: {
        description: publicTruth.description,
        flyer: publicTruth.flyer,
        capturedAt: new Date().toISOString(),
      },
      before: backupRow
        ? {
            description: backupRow.description,
            image_url: backupRow.image_url,
            apiProjection: backupRow.apiProjection,
          }
        : beforeAfter?.events?.[eventId] ?? null,
      after: {
        db,
        canonicalReader: {
          title: canonicalReader.title,
          description: canonicalReader.description,
          imageUrl: canonicalReader.imageUrl,
        },
        apiProjection,
        viewModel,
        galleryViewer: {
          galleryImageUrls: gallery,
          fullscreenImage: gallery[0] ?? viewModel.heroImageUrl,
        },
      },
      frozenDomainsSnapshot: frozen,
      checks,
      layersAligned,
      divergenceCause,
      pass: Object.values(checks).every(Boolean) && layersAligned,
    };
  }

  writeJson('_phase4823_consumer_verification.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.3',
    productionMutationsInThisRun,
    events,
    allPass: Object.values(events).every((e) => (e as { pass: boolean }).pass),
    note: 'Web/mobile Event Detail uses same projection path as ViewModel; browser cache not probed remotely.',
  });
}

async function verifyRegression(): Promise<void> {
  verifyNoWrite();
  if (!existsSync(FORBIDDEN_BEFORE_PATH)) {
    throw new Error('Missing _phase4822_forbidden_fingerprints.json — run Phase 4.8.2.2 backup first');
  }
  const before = readJson<{ before: Record<string, { hash: string; fingerprint: Record<string, unknown> }> }>(
    '_phase4822_forbidden_fingerprints.json',
  ).before;

  const results: Record<string, unknown> = {};
  for (const eventId of [SOMMERFEST_EVENT_ID, R3HAB_EVENT_ID]) {
    const event = await loadEvent(eventId);
    if (!event) throw new Error(`Missing event ${eventId}`);
    const fp = buildForbiddenFingerprint(event);
    const hash = hashFingerprint(fp);
    const prior = before[eventId];
    results[eventId] = {
      hashBefore: prior?.hash,
      hashAfter: hash,
      unchanged: prior?.hash === hash,
      fingerprint: fp,
    };
  }

  writeJson('_phase4823_regression_check.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.3',
    productionMutationsInThisRun,
    events: results,
    allForbiddenUnchanged: Object.values(results).every((r) => (r as { unchanged: boolean }).unchanged),
  });
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

function projectionField(projection: ReturnType<typeof projectCanonicalEventFields>, field: string): unknown {
  const map: Record<string, unknown> = {
    title: projection.qualityState,
    description: projection.sanitizedDescription,
    flyer: projection.heroImageUrl,
    gallery: projection.galleryImageUrls,
    genres: projection.genres,
    ticketUrl: projection.ticketUrl,
    venue: projection.venueLabel,
    location: projection.locationLabelComma,
    city: projection.cityLabel,
  };
  return map[field];
}

function canonicalField(row: EventRow | null, field: string): unknown {
  if (!row) return undefined;
  if (field === 'flyer' || field === 'gallery') return row.image_url;
  if (field === 'description') return row.description;
  if (field === 'title') return row.title;
  if (field === 'dateTime') return row.start_date;
  if (field === 'venue') return row.venue_name;
  if (field === 'location') return row.venue_address;
  if (field === 'city') return row.venue_city;
  if (field === 'ticketUrl') return row.ticket_url;
  if (field === 'genres') return row.genre_labels;
  return undefined;
}

async function refreshShadow(): Promise<void> {
  verifyNoWrite();
  const sample = loadOfficialWebsiteSample();
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const client = wrapClientForShadowReadOnly(opsClient());

  const captures: Array<Record<string, unknown>> = [];
  const comparisons: Array<Record<string, unknown>> = [];
  const totals: Partial<Record<ShadowFieldStatus, number>> = {};

  for (const item of sample) {
    const url = item.websiteUrl ?? item.url;
    const fetch = await pilotFetchHtml(url);
    await sleep(RATE_LIMIT_MS);
    let html = fetch.html ?? '';
    if (html) {
      const safeName = `live-${item.sampleId}.html`;
      writeFileSync(join(EVIDENCE_DIR, safeName), html, 'utf8');
    }
    const publicTruth = html ? extractOfficialWebsitePublicTruth(html, url) : null;
    const pilot = await runOfficialWebsitePilotForEvent(toRef(item));
    const { data: row } = await client.from('events').select('*').eq('id', item.eventId).maybeSingle();
    const event = row ? mapEventRowToDomain(row as EventRow) : null;
    const projection = event
      ? projectCanonicalEventFields({
          title: event.title,
          description: event.description,
          imageUrl: event.imageUrl,
          venue: event.venue,
          city: event.city,
          genres: event.genres,
          artists: event.artists ?? [],
          ticketUrl: event.ticketUrl,
          ticketStatus: event.ticketStatus,
          source: event.source,
        })
      : null;

    captures.push({
      eventId: item.eventId,
      sampleId: item.sampleId,
      url,
      contentHash: html ? hashPublicHtml(html) : null,
      capturedAt: new Date().toISOString(),
      htmlPath: html ? `_phase4823_live_evidence/live-${item.sampleId}.html` : null,
    });

    for (const field of CLAIMED_FIELDS) {
      const publicValue =
        field === 'ticketUrl'
          ? publicTruth?.outboundTicketLinks?.[0]
          : (publicTruth as Record<string, unknown> | null)?.[field === 'dateTime' ? 'dateTime' : field];
      const unifiedValue = extractUnifiedField(pilot, item.eventId, field);
      const canonicalValue = canonicalField(row as EventRow | null, field);
      const projectionValue = projection ? projectionField(projection, field) : undefined;

      const status = classifyShadowFieldComparison({
        field,
        publicTruth: publicValue,
        unified: field === 'genres' && Array.isArray(unifiedValue) ? unifiedValue.join(', ') : unifiedValue,
        canonical: Array.isArray(canonicalValue) ? canonicalValue.join(', ') : canonicalValue,
        projection: Array.isArray(projectionValue) ? projectionValue.join(', ') : projectionValue,
        sourceChangedDuringShadow: false,
      });

      totals[status] = (totals[status] ?? 0) + 1;
      comparisons.push({
        eventId: item.eventId,
        title: item.label,
        field,
        status,
        publicTruth: publicValue,
        unified: unifiedValue,
        canonical: canonicalValue,
        projection: projectionValue,
      });
    }
  }

  writeJson('_phase4823_fresh_shadow.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.3',
    productionMutationsInThisRun,
    importer: IMPORTER_KEY,
    importerVersion: IMPORTER_VERSION,
    sourceIds: [PRODUCTION_BOOTSHAUS_SOURCE_ID, PRODUCTION_AFFENKAEFIG_SOURCE_ID],
    mode: 'live',
    eventCount: sample.length,
    captureCount: captures.length,
    comparisonCount: comparisons.length,
    totals,
    captures,
    comparisons,
  });
}

function buildProposalsFromShadow(): ControlledBatchProposal[] {
  const shadow = readJson<{
    comparisons: Array<{
      eventId: string;
      title: string;
      field: string;
      status: ShadowFieldStatus;
      publicTruth?: unknown;
      unified?: unknown;
      canonical?: unknown;
      projection?: unknown;
    }>;
  }>('_phase4823_fresh_shadow.json');

  const proposals: ControlledBatchProposal[] = [];
  for (const row of shadow.comparisons) {
    if (
      row.status !== 'STALE_CANONICAL_PRODUCTION' &&
      row.status !== 'UNIFIED_MATCHES_PUBLIC_TRUTH' &&
      row.status !== 'UNIFIED_BETTER'
    ) {
      continue;
    }
    if (row.field === 'ticketUrl' || row.field === 'subtitle') continue;

    const category =
      row.field === 'description'
        ? 'description_correction'
        : row.field === 'flyer' || row.field === 'gallery'
          ? 'flyer_gallery_correction'
          : row.field === 'genres'
            ? 'genre_enrichment'
            : 'field_correction';

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
      unifiedValue: row.unified,
      reason:
        row.status === 'STALE_CANONICAL_PRODUCTION'
          ? 'Canonical production stale vs live public truth'
          : 'Unified importer matches live public truth',
      consumerVisible: true,
      affectedOutput: ['event-detail', 'discovery-card', 'gallery-viewer'],
      frozenDomains: ['price', 'ticket_phases', 'availability', 'sold_out', 'checkout_url', 'lineup'],
      execute: false,
    });
  }
  return proposals;
}

async function buildReviewPackage(): Promise<void> {
  verifyNoWrite();
  if (!existsSync(join(OUT, '_phase4823_fresh_shadow.json'))) {
    throw new Error('Run refresh-shadow first');
  }

  const proposals = buildProposalsFromShadow();
  const classified = classifyAllProposals(proposals);
  const elevated = elevateMissedProductionFixes(
    readJson<{ comparisons: Array<Record<string, unknown>> }>('_phase4823_fresh_shadow.json').comparisons as Parameters<
      typeof elevateMissedProductionFixes
    >[0],
  );

  for (const item of elevated) {
    const exists = classified.some(
      (c) => c.proposal.eventId === item.eventId && c.proposal.field === item.field,
    );
    if (!exists) {
      classified.push(
        classifyAllProposals([
          {
            eventId: item.eventId,
            title: item.title,
            field: item.field,
            currentCanonical: item.currentCanonical,
            proposedValue: item.proposedValue,
            publicEvidence: item.publicEvidence,
            sourceRole: 'official_website_source',
            confidence: 0.9,
          },
        ])[0],
      );
    }
  }

  const summary = summarizeClassifications(classified);
  const realFixes = classified.map(toRealProductionFix).filter((f): f is RealProductionFix => f !== null);

  writeJson('_phase4823_next_review_package.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.3',
    productionMutationsInThisRun,
    sourceShadow: '_phase4823_fresh_shadow.json',
    totalProposalsReviewed: classified.length,
    classificationSummary: summary,
    elevatedFromFieldComparison: elevated,
    realProductionFixCount: realFixes.length,
    reviewRequiredCount: summary.REVIEW_REQUIRED,
    classified,
    highRiskSeparated: classified.filter((c) => c.risk === 'HIGH'),
  });
}

async function previewNextBatch(): Promise<void> {
  verifyNoWrite();
  const pkg = readJson<{
    classified: ClassifiedProposal[];
  }>('_phase4823_next_review_package.json');

  const classified = pkg.classified;

  const realFixes = classified
    .filter((c) => c.classification === 'REAL_PRODUCTION_FIX')
    .map((c) => toRealProductionFix(c))
    .filter((f): f is RealProductionFix => f !== null);

  const lowMedium = realFixes.filter((f) => f.risk === 'LOW' || f.risk === 'MEDIUM');
  const highRisk = realFixes.filter((f) => f.risk === 'HIGH');

  const eventIds = new Set<string>();
  const selected: RealProductionFix[] = [];
  for (const fix of lowMedium) {
    if (selected.length >= 15) break;
    if (eventIds.size >= 10 && !eventIds.has(fix.eventId)) continue;
    selected.push(fix);
    eventIds.add(fix.eventId);
  }

  const fingerprints: Record<string, { hash: string }> = {};
  for (const eventId of eventIds) {
    const event = await loadEvent(eventId);
    if (!event) continue;
    const fp = buildForbiddenFingerprint(event);
    fingerprints[eventId] = { hash: hashFingerprint(fp) };
  }

  writeJson('_phase4823_next_batch_preview.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.3',
    productionMutationsInThisRun,
    execute: false,
    limits: {
      maxEvents: 10,
      maxFieldChanges: 15,
      allowedRisk: ['LOW', 'MEDIUM'],
    },
    totalProposedChanges: selected.length,
    affectedEvents: eventIds.size,
    affectedEventIds: [...eventIds],
    highRiskSeparatedForHumanReview: highRisk,
    proposals: selected,
    frozenDomainFingerprints: fingerprints,
    rollbackStrategy: [
      'Snapshot affected event rows before any future apply',
      'Per-field restore from snapshot on rollback',
      'No importer schedule activation in preview phase',
    ],
  });
}

async function runReport(): Promise<void> {
  const consumer = existsSync(join(OUT, '_phase4823_consumer_verification.json'))
    ? readJson<Record<string, unknown>>('_phase4823_consumer_verification.json')
    : null;
  const regression = existsSync(join(OUT, '_phase4823_regression_check.json'))
    ? readJson<Record<string, unknown>>('_phase4823_regression_check.json')
    : null;
  const shadow = existsSync(join(OUT, '_phase4823_fresh_shadow.json'))
    ? readJson<{ comparisonCount: number; totals: Record<string, number> }>('_phase4823_fresh_shadow.json')
    : null;
  const review = existsSync(join(OUT, '_phase4823_next_review_package.json'))
    ? readJson<{ classificationSummary: Record<string, number>; realProductionFixCount: number }>(
        '_phase4823_next_review_package.json',
      )
    : null;
  const preview = existsSync(join(OUT, '_phase4823_next_batch_preview.json'))
    ? readJson<{ totalProposedChanges: number; proposals: RealProductionFix[] }>('_phase4823_next_batch_preview.json')
    : null;

  const md = `# Phase 4.8.2.3 — Post-Batch Consumer Verification

Generated: ${new Date().toISOString()}

## Scope

- Verifies Phase 4.8.2.2 consumer result (Bootshaus Sommerfest + R3HAB)
- Fresh live Official Website shadow (Bootshaus.tv + Affenkäfig.info)
- Next controlled-batch preview (not executed)
- **Production mutations this phase: ${productionMutationsInThisRun}**

## Consumer verification

- All pass: **${consumer && (consumer as { allPass?: boolean }).allPass ? 'YES' : 'see JSON'}**
- Regression fingerprints unchanged: **${regression && (regression as { allForbiddenUnchanged?: boolean }).allForbiddenUnchanged ? 'YES' : 'see JSON'}**

## Fresh shadow

- Comparisons: **${shadow?.comparisonCount ?? 'N/A'}**
- REAL_PRODUCTION_FIX: **${review?.realProductionFixCount ?? 'N/A'}**
- REVIEW_REQUIRED: **${review?.classificationSummary?.REVIEW_REQUIRED ?? 'N/A'}**

## Next batch preview (LOW/MEDIUM only)

- Proposed changes: **${preview?.totalProposedChanges ?? 'N/A'}**
- Execute: **false**

## Artifacts

- \`docs/real-data/_phase4823_consumer_verification.json\`
- \`docs/real-data/_phase4823_regression_check.json\`
- \`docs/real-data/_phase4823_fresh_shadow.json\`
- \`docs/real-data/_phase4823_next_review_package.json\`
- \`docs/real-data/_phase4823_next_batch_preview.json\`
`;

  writeFileSync(REPORT, md);
  console.log(JSON.stringify({ report: REPORT, productionMutationsInThisRun }, null, 2));
}

async function main(): Promise<void> {
  switch (command) {
    case 'verify-consumer':
      await verifyConsumer();
      console.log(JSON.stringify({ ok: true, artifact: '_phase4823_consumer_verification.json' }, null, 2));
      break;
    case 'verify-regression':
      await verifyRegression();
      console.log(JSON.stringify({ ok: true, artifact: '_phase4823_regression_check.json' }, null, 2));
      break;
    case 'refresh-shadow':
      await refreshShadow();
      console.log(JSON.stringify({ ok: true, artifact: '_phase4823_fresh_shadow.json' }, null, 2));
      break;
    case 'build-review-package':
      await buildReviewPackage();
      console.log(JSON.stringify({ ok: true, artifact: '_phase4823_next_review_package.json' }, null, 2));
      break;
    case 'preview-next-batch':
      await previewNextBatch();
      console.log(JSON.stringify({ ok: true, artifact: '_phase4823_next_batch_preview.json' }, null, 2));
      break;
    case 'report':
      await runReport();
      break;
    default:
      console.log(
        'Commands: verify-consumer | verify-regression | refresh-shadow | build-review-package | preview-next-batch | report',
      );
      process.exit(command === 'help' ? 0 : 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
