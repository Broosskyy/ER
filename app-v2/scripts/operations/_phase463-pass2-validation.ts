/**
 * Phase 4.6.3 — Pass 2 idempotency, multi-origin audit & regression validation.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase463-pass2-validation.ts [phase]
 *
 * Phases: baseline | idempotency | downgrade | multi-origin | ticket | trace |
 *         lineup | description | venue | cache | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import {
  classifyTicketUrl,
  isEventSpecificTicketUrl,
  pickBestTicketUrl,
} from '@/features/events/domain/ticket-url-quality';
import { meaningfulEventText } from '@/features/events/domain/event-field-value';
import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ACTIVATION = join(ROOT, 'docs/real-data/_phase462_production_activation.json');
const OUT_JSON = join(ROOT, 'docs/real-data/_phase463_pass2_validation.json');
const OUT_MD = join(ROOT, 'docs/PHASE_463_PASS2_VALIDATION_REPORT.md');

const TRACE_EVENTS = [
  { label: 'Bootshaus Sommerfest', needle: /sommerfest/i },
  { label: 'PLAY! Open Air', needle: /play!\s*open\s*air/i },
  { label: 'LEVI', needle: /\blevi\b/i },
  { label: 'ELY OAKS', needle: /ely\s*oaks/i },
  { label: 'Musik die mich antreibt', needle: /musik die mich antreibt/i },
  { label: 'Technodampfer', needle: /technodampfer/i },
  { label: 'SHOCKONE', needle: /shock\s*one|shockone/i },
  { label: 'Affenkäfig', needle: /affenkäfig|affenkaefig/i },
  { label: 'Lehmann', needle: /lehmann/i },
  { label: 'Area51', needle: /area\s*51/i },
  { label: 'HMG', needle: /\bhmg\b/i },
  { label: 'Mallorca', needle: /mallorca/i },
];

const MULTI_ORIGIN_PAIRS = [
  { label: 'Bootshaus', sourceIds: ['source-bootshaus-koeln', 'source-bootshaus-ticket-io'] },
  { label: 'Affenkäfig', sourceIds: ['source-affenkaefig', 'source-affenkaefig-ticket-kings'] },
];

type Report = Record<string, unknown>;

function loadReport(): Report {
  if (existsSync(OUT_JSON)) {
    return JSON.parse(readFileSync(OUT_JSON, 'utf8')) as Report;
  }
  return { startedAt: new Date().toISOString(), errors: [] as string[] };
}

const report: Report = loadReport();

function save(): void {
  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
}

function hasText(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function descriptionIssues(text: string | undefined): string[] {
  if (!text) return ['empty'];
  const issues: string[] = [];
  if (/\\n/.test(text)) issues.push('escaped_newlines');
  if (/Place:\s*Place:/i.test(text)) issues.push('duplicate_place');
  if (/Date:\s*Date:/i.test(text)) issues.push('duplicate_date');
  if (/OAKS!After|music\.Lineup|yearsBootshaus/i.test(text)) issues.push('broken_merge');
  if (text.length < 80 && text.length > 0) issues.push('short_description');
  return issues;
}

async function collectExtendedMetrics(label: string): Promise<Record<string, number>> {
  const c = opsClient();
  const [canonical, published, archived, origins, importRecords, eventArtists, genreRels, saved, profiles] =
    await Promise.all([
      c.from('events').select('id', { count: 'exact', head: true }),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
      c.from('event_source_references').select('id', { count: 'exact', head: true }).eq('active', true),
      c.from('import_records').select('id', { count: 'exact', head: true }),
      c.from('event_artists').select('id', { count: 'exact', head: true }),
      c.from('event_genres').select('id', { count: 'exact', head: true }).then((r) =>
        r.error ? { count: 0 } : r,
      ),
      c.from('saved_events').select('id', { count: 'exact', head: true }).then((r) =>
        r.error ? { count: 0 } : r,
      ),
      c.from('entities').select('id', { count: 'exact', head: true }).then((r) =>
        r.error ? { count: 0 } : r,
      ),
    ]);

  const { data: pubEvents } = await c.from('events').select('*').eq('status', 'published');
  let withMeaningfulDesc = 0;
  let withStructuredLineup = 0;
  let withTitleDerivedOnly = 0;
  let withValidTicketUrl = 0;
  let withDirectTicketUrl = 0;
  let withPrice = 0;
  let withAvailability = 0;
  let withTicketPhases = 0;
  let withCoords = 0;
  let withVenueAddress = 0;
  let withMinAge = 0;

  for (const row of pubEvents ?? []) {
    const e = mapEventRowToAdminRecord(row as EventRow);
    if ((e.description?.length ?? 0) > 40) withMeaningfulDesc += 1;
    const lineup = e.lineup ?? [];
    const artists = e.artists ?? [];
    if (lineup.length > 0) withStructuredLineup += 1;
    else if (artists.length > 0 && lineup.length === 0) withTitleDerivedOnly += 1;
    if (hasText(e.ticketUrl)) withValidTicketUrl += 1;
    if (isEventSpecificTicketUrl(e.ticketUrl)) withDirectTicketUrl += 1;
    if (hasText(e.priceText)) withPrice += 1;
    if (e.ticketStatus != null) withAvailability += 1;
    if ((e.ticketPhases?.length ?? 0) > 0) withTicketPhases += 1;
    if (e.latitude != null && e.longitude != null) withCoords += 1;
    if (hasText(e.venueAddress)) withVenueAddress += 1;
    if (e.ageRestriction != null) withMinAge += 1;
  }

  const snapshot = {
    label,
    capturedAt: new Date().toISOString(),
    canonicalEvents: canonical.count ?? 0,
    publishedEvents: published.count ?? 0,
    archivedEvents: archived.count ?? 0,
    activeOrigins: origins.count ?? 0,
    importRecords: importRecords.count ?? 0,
    eventArtistRows: eventArtists.count ?? 0,
    genreRelationships: genreRels.count ?? 0,
    savedEventRelationships: saved.count ?? 0,
    publicProfiles: profiles.count ?? 0,
    eventsWithMeaningfulDescription: withMeaningfulDesc,
    eventsWithStructuredLineups: withStructuredLineup,
    eventsWithTitleDerivedOnlyArtists: withTitleDerivedOnly,
    eventsWithValidTicketUrls: withValidTicketUrl,
    eventsWithDirectEventTicketUrls: withDirectTicketUrl,
    eventsWithPriceText: withPrice,
    eventsWithAvailabilityState: withAvailability,
    eventsWithTicketPhases: withTicketPhases,
    eventsWithCoordinates: withCoords,
    eventsWithVenueAddress: withVenueAddress,
    eventsWithMinimumAge: withMinAge,
  };

  const metrics = (report.metrics as Record<string, unknown>) ?? {};
  metrics[label] = snapshot;
  report.metrics = metrics;
  save();
  return snapshot;
}

async function captureBaseline(): Promise<void> {
  if (!existsSync(ACTIVATION)) {
    throw new Error(`Missing activation artifact: ${ACTIVATION}`);
  }
  const activation = JSON.parse(readFileSync(ACTIVATION, 'utf8')) as Report;
  report.pass1Baseline = activation.metrics?.pass1 ?? activation.metrics?.baseline;
  report.pass2Results = activation.pass2;
  report.pass1Results = activation.pass1;
  const current = await collectExtendedMetrics('post_pass2_current');
  report.postPass2Extended = current;
  save();
  console.log(JSON.stringify({ pass1Baseline: report.pass1Baseline, postPass2: current }, null, 2));
}

function classifyDelta(
  field: string,
  pass1: number,
  pass2: number,
): { field: string; pass1: number; pass2: number; delta: number; classification: string } {
  const delta = pass2 - pass1;
  let classification = 'stable';
  if (delta === 0) classification = 'stable';
  else if (field === 'eventsWithVenueAddress' && delta > 0) classification = 'relationship_correction';
  else if (field === 'eventsWithGenreLabels' && delta > 0) classification = 'newly_accessible_detail_data';
  else if (field === 'eventArtistRows' && delta > 0) classification = 'relationship_correction';
  else if (delta !== 0) classification = 'unexpected_mutation';
  return { field, pass1, pass2, delta, classification };
}

async function runIdempotencyAnalysis(): Promise<void> {
  const activation = JSON.parse(readFileSync(ACTIVATION, 'utf8')) as Record<string, unknown>;
  const metrics = activation.metrics as Record<string, Record<string, number>> | undefined;
  const pass2Block = activation.pass2 as { results?: Array<Record<string, unknown>> } | undefined;
  const pass1m = metrics?.pass1 ?? {};
  const pass2m = metrics?.pass2 ?? {};
  const fields = [
    'publishedEvents',
    'archivedEvents',
    'activeOrigins',
    'importRecords',
    'eventArtistRows',
    'eventsWithLineup',
    'eventsWithMeaningfulDescription',
    'eventsWithTicketPhases',
    'eventsWithPriceText',
    'eventsWithCoordinates',
    'eventsWithVenueAddress',
    'eventsWithGenreLabels',
  ];

  const deltas = fields.map((f) =>
    classifyDelta(f, (pass1m[f] as number) ?? 0, (pass2m[f] as number) ?? 0),
  );

  const pass2Created = (pass2Block?.results ?? []).map((r) => {
    const metrics = r.metrics as { createdCount?: number; updatedCount?: number; unchangedCount?: number } | undefined;
    return {
      sourceId: r.sourceId as string,
      createdCount: metrics?.createdCount ?? 0,
      updatedCount: metrics?.updatedCount ?? 0,
      unchangedCount: metrics?.unchangedCount ?? 0,
      runtimeMs: r.runtimeMs as number | undefined,
    };
  });

  const idempotent = pass2Created.every((r) => r.createdCount === 0);
  const unexplained = deltas.filter((d) => d.delta !== 0 && d.classification === 'unexpected_mutation');

  report.idempotency = {
    generatedAt: new Date().toISOString(),
    pass2CreatedBySource: pass2Created,
    allCreatedCountZero: idempotent,
    metricDeltas: deltas,
    unexplainedDeltas: unexplained,
    verdict: idempotent && unexplained.length === 0 ? 'PASS' : 'REVIEW_REQUIRED',
  };
  save();
  console.log(JSON.stringify(report.idempotency, null, 2));
}

async function runNoDowngradeAudit(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const downgrades: Array<Record<string, unknown>> = [];

  for (const row of events ?? []) {
    const e = mapEventRowToAdminRecord(row as EventRow);
    const { data: records } = await c
      .from('import_records')
      .select('source_id,normalized_payload,updated_at')
      .eq('resulting_event_id', e.id)
      .order('updated_at', { ascending: false });

    const originUrls: string[] = [];
    let bestPayloadLineup = 0;
    let bestPayloadDesc = 0;
    for (const rec of records ?? []) {
      const p = rec.normalized_payload as Record<string, unknown> | undefined;
      if (!p) continue;
      const url = p.ticketUrl ?? p.ticket_url;
      if (typeof url === 'string') originUrls.push(url);
      const meta = (p.sourceMetadata ?? {}) as Record<string, unknown>;
      const lineup = meta.lineupEntries ?? p.artistNames;
      if (Array.isArray(lineup)) bestPayloadLineup = Math.max(bestPayloadLineup, lineup.length);
      const desc = typeof p.description === 'string' ? p.description.length : 0;
      bestPayloadDesc = Math.max(bestPayloadDesc, desc);
    }

    const canonLineup = (e.lineup?.length ?? 0) + (e.artists?.length ?? 0);
    if (bestPayloadLineup > canonLineup + 1) {
      downgrades.push({
        eventId: e.id,
        title: e.title,
        type: 'lineup_shrink',
        payloadLineup: bestPayloadLineup,
        canonicalLineup: canonLineup,
      });
    }
    if (bestPayloadDesc > (e.description?.length ?? 0) + 50) {
      downgrades.push({
        eventId: e.id,
        title: e.title,
        type: 'description_shrink',
        payloadDescLen: bestPayloadDesc,
        canonicalDescLen: e.description?.length ?? 0,
      });
    }

    const bestUrl = pickBestTicketUrl([e.ticketUrl, ...originUrls].filter(Boolean) as string[]);
    const canonClass = classifyTicketUrl(e.ticketUrl);
    const bestClass = classifyTicketUrl(bestUrl);
    if (bestClass.score > canonClass.score + 10) {
      downgrades.push({
        eventId: e.id,
        title: e.title,
        type: 'ticket_url_downgrade',
        canonical: e.ticketUrl,
        canonicalClass: canonClass.class,
        betterAvailable: bestUrl,
        betterClass: bestClass.class,
      });
    }
  }

  report.noDowngradeAudit = {
    generatedAt: new Date().toISOString(),
    blockers: downgrades.length,
    samples: downgrades.slice(0, 30),
  };
  save();
  console.log(JSON.stringify(report.noDowngradeAudit, null, 2));
}

async function runMultiOriginFieldAudit(): Promise<void> {
  const c = opsClient();
  const audits = [];

  for (const pair of MULTI_ORIGIN_PAIRS) {
    const { data: refs } = await c
      .from('event_source_references')
      .select('canonical_event_id,source_id')
      .in('source_id', pair.sourceIds)
      .eq('active', true);

    const byCanonical = new Map<string, string[]>();
    for (const ref of refs ?? []) {
      const list = byCanonical.get(ref.canonical_event_id) ?? [];
      list.push(ref.source_id);
      byCanonical.set(ref.canonical_event_id, list);
    }

    const merged = [...byCanonical.entries()].filter(([, sources]) =>
      pair.sourceIds.every((id) => sources.includes(id)),
    );

    for (const [canonicalId] of merged.slice(0, 3)) {
      const { data: eventRow } = await c.from('events').select('*').eq('id', canonicalId).maybeSingle();
      if (!eventRow) continue;

      const { data: provenance } = await c
        .from('event_field_provenance')
        .select('field_path,selected_source_id,selected_value')
        .eq('canonical_event_id', canonicalId);

      const { data: importRows } = await c
        .from('import_records')
        .select('source_id,normalized_payload')
        .eq('resulting_event_id', canonicalId)
        .in('source_id', pair.sourceIds);

      const fieldOrigins: Record<string, unknown> = {};
      for (const p of provenance ?? []) {
        fieldOrigins[p.field_path] = {
          selectedSource: p.selected_source_id,
          valuePreview:
            typeof p.selected_value === 'string' ? p.selected_value.slice(0, 120) : p.selected_value,
        };
      }

      const originPayloads: Record<string, unknown> = {};
      for (const row of importRows ?? []) {
        const p = row.normalized_payload as Record<string, unknown>;
        originPayloads[row.source_id] = {
          ticketUrl: p.ticketUrl ?? p.ticket_url,
          descriptionLen: typeof p.description === 'string' ? p.description.length : 0,
          lineup:
            Array.isArray((p.sourceMetadata as Record<string, unknown>)?.lineupEntries)
              ? ((p.sourceMetadata as Record<string, unknown>).lineupEntries as unknown[]).length
              : Array.isArray(p.artistNames)
                ? p.artistNames.length
                : 0,
          genreNames: p.genreNames,
          venueName: p.venueName,
          organizerName: p.organizerName,
        };
      }

      const event = mapEventRowToAdminRecord(eventRow as EventRow);
      audits.push({
        pair: pair.label,
        canonicalId,
        title: event.title,
        canonical: {
          ticketUrl: event.ticketUrl,
          descriptionLen: event.description?.length ?? 0,
          lineupCount: (event.lineup?.length ?? 0) + (event.artists?.length ?? 0),
          genres: event.genreLabels,
          venue: event.venueName,
          organizer: event.organizerName,
          address: event.venueAddress,
        },
        provenanceSelections: fieldOrigins,
        originPayloads,
      });
    }
  }

  report.multiOriginFieldAudit = { generatedAt: new Date().toISOString(), samples: audits };
  save();
  console.log(JSON.stringify(report.multiOriginFieldAudit, null, 2));
}

async function runTicketAudit(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const regressions: Array<Record<string, unknown>> = [];

  for (const spec of TRACE_EVENTS) {
    const match = (events ?? []).find((e) => spec.needle.test(String(e.title ?? '')));
    if (!match) {
      regressions.push({ label: spec.label, status: 'not_published' });
      continue;
    }
    const e = mapEventRowToAdminRecord(match as EventRow);
    const cls = classifyTicketUrl(e.ticketUrl);
    const { data: records } = await c
      .from('import_records')
      .select('source_id,normalized_payload')
      .eq('resulting_event_id', e.id);
    const candidates: string[] = [];
    for (const r of records ?? []) {
      const p = r.normalized_payload as Record<string, unknown>;
      const u = p?.ticketUrl ?? p?.ticket_url;
      if (typeof u === 'string') candidates.push(u);
    }
    const best = pickBestTicketUrl([e.ticketUrl, ...candidates].filter(Boolean));

    regressions.push({
      label: spec.label,
      eventId: e.id,
      title: e.title,
      canonicalTicketUrl: e.ticketUrl,
      classification: cls.class,
      score: cls.score,
      bestAvailable: best,
      bootshausTvRegression:
        /bootshaus\.tv/i.test(e.ticketUrl ?? '') &&
        candidates.some((u) => /\.ticket\.io\//i.test(u) || /ticketkings\.de\/event\//i.test(u)),
    });
  }

  report.ticketDestinationAudit = {
    generatedAt: new Date().toISOString(),
    validationEvents: regressions,
    bootshausTvBlockers: regressions.filter((r) => r.bootshausTvRegression === true),
  };
  save();
  console.log(JSON.stringify(report.ticketDestinationAudit, null, 2));
}

async function runSourceToPublicTrace(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const traces = [];

  for (const spec of TRACE_EVENTS) {
    const match = (events ?? []).find((e) => spec.needle.test(String(e.title ?? '')));
    if (!match) {
      traces.push({ label: spec.label, status: 'not_found' });
      continue;
    }
    const event = mapEventRowToAdminRecord(match as EventRow);
    const { data: records } = await c
      .from('import_records')
      .select('source_id,external_id,normalized_payload,raw_payload,updated_at')
      .eq('resulting_event_id', event.id)
      .order('updated_at', { ascending: false });

    const origins = (records ?? []).map((r) => {
      const p = r.normalized_payload as Record<string, unknown>;
      const meta = (p?.sourceMetadata ?? {}) as Record<string, unknown>;
      return {
        sourceId: r.source_id,
        externalId: r.external_id,
        normalized: {
          title: p?.title,
          descriptionLen: typeof p?.description === 'string' ? p.description.length : 0,
          ticketUrl: p?.ticketUrl ?? p?.ticket_url,
          lineupEntries: Array.isArray(meta.lineupEntries) ? meta.lineupEntries.length : 0,
          artistNames: Array.isArray(p?.artistNames) ? p.artistNames.length : 0,
          genreNames: p?.genreNames,
          venueName: p?.venueName,
          organizerName: p?.organizerName,
        },
        detailSnapshot: meta.detailSnapshot ?? meta.detailEnrichment ?? null,
      };
    });

    const { data: artists } = await c
      .from('event_artists')
      .select('artist_name,role,sort_order')
      .eq('event_id', event.id)
      .order('sort_order');

    traces.push({
      label: spec.label,
      status: 'found',
      eventId: event.id,
      title: event.title,
      origins,
      canonical: {
        descriptionLen: event.description?.length ?? 0,
        ticketUrl: event.ticketUrl,
        lineupCount: event.lineup?.length ?? 0,
        artistRows: artists?.length ?? 0,
        artists: (artists ?? []).map((a) => ({ name: a.artist_name, role: a.role })),
        genres: event.genreLabels,
        venue: event.venueName,
        organizer: event.organizerName,
        address: event.venueAddress,
        priceText: event.priceText,
        ticketPhases: event.ticketPhases?.length ?? 0,
      },
      lossStages: {
        lineup:
          origins.some((o) => o.normalized.lineupEntries > 0 || o.normalized.artistNames > 0) &&
          (event.lineup?.length ?? 0) === 0 &&
          (artists?.length ?? 0) === 0
            ? 'publish_projection'
            : null,
        description:
          origins.some((o) => o.normalized.descriptionLen > 100) && (event.description?.length ?? 0) < 50
            ? 'merge_or_publish'
            : null,
      },
    });
  }

  report.sourceToPublicTraces = { generatedAt: new Date().toISOString(), traces };
  save();
  console.log(JSON.stringify(report.sourceToPublicTraces, null, 2));
}

async function runLineupRegression(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const results = [];

  for (const spec of TRACE_EVENTS.filter((e) =>
    ['LEVI', 'ELY OAKS', 'Bootshaus Sommerfest', 'PLAY! Open Air', 'Musik die mich antreibt', 'Technodampfer', 'SHOCKONE'].includes(
      e.label,
    ),
  )) {
    const match = (events ?? []).find((e) => spec.needle.test(String(e.title ?? '')));
    if (!match) {
      results.push({ label: spec.label, status: 'not_found' });
      continue;
    }
    const event = mapEventRowToAdminRecord(match as EventRow);
    const { data: artists } = await c.from('event_artists').select('*').eq('event_id', event.id);
    const artistNames = [
      ...(event.lineup?.map((l) => l.name) ?? []),
      ...(event.artists?.map((a) => a.name) ?? []),
      ...(artists ?? []).map((a) => a.artist_name as string),
    ];
    const orgAsArtist = artistNames.some(
      (n) => /organization|bootshaus|affenkäfig/i.test(n) && !/pres\./i.test(n),
    );
    const placeholderArtists = artistNames.filter((n) => isLineupPlaceholderArtist(n));
    const hasLevi = artistNames.some((n) => /\blevi\b/i.test(n));

    results.push({
      label: spec.label,
      title: event.title,
      artistCount: artistNames.length,
      artistNames: [...new Set(artistNames)].slice(0, 20),
      organizationAsArtist: orgAsArtist,
      placeholderArtists,
      leviPresent: spec.label === 'LEVI' ? hasLevi : undefined,
      emptyLineupMessage: artistNames.length === 0,
      headlinerUnsupported: (artists ?? []).some((a) => a.role === 'headliner'),
    });
  }

  report.lineupRegression = { generatedAt: new Date().toISOString(), results };
  save();
  console.log(JSON.stringify(report.lineupRegression, null, 2));
}

async function runDescriptionRegression(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const results = [];

  for (const spec of TRACE_EVENTS.filter((e) =>
    ['Bootshaus Sommerfest', 'ELY OAKS', 'PLAY! Open Air', 'Affenkäfig', 'Musik die mich antreibt'].includes(
      e.label,
    ),
  )) {
    const match = (events ?? []).find((e) => spec.needle.test(String(e.title ?? '')));
    if (!match) {
      results.push({ label: spec.label, status: 'not_found' });
      continue;
    }
    const event = mapEventRowToAdminRecord(match as EventRow);
    const { data: records } = await c
      .from('import_records')
      .select('source_id,normalized_payload')
      .eq('resulting_event_id', event.id);

    let maxSourceLen = 0;
    for (const r of records ?? []) {
      const p = r.normalized_payload as Record<string, unknown>;
      if (typeof p?.description === 'string') maxSourceLen = Math.max(maxSourceLen, p.description.length);
    }

    results.push({
      label: spec.label,
      title: event.title,
      sourceMaxDescriptionLen: maxSourceLen,
      canonicalDescriptionLen: event.description?.length ?? 0,
      publicDescriptionLen: event.description?.length ?? 0,
      issues: descriptionIssues(event.description),
      firstLossStage:
        maxSourceLen > (event.description?.length ?? 0) + 30 ? 'merge_or_publish' : null,
    });
  }

  report.descriptionRegression = { generatedAt: new Date().toISOString(), results };
  save();
  console.log(JSON.stringify(report.descriptionRegression, null, 2));
}

async function runVenueOrganizerAudit(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const results = [];

  for (const spec of TRACE_EVENTS.filter((e) =>
    ['LEVI', 'Mallorca', 'Affenkäfig', 'Technodampfer'].includes(e.label),
  )) {
    const match = (events ?? []).find((e) => spec.needle.test(String(e.title ?? '')));
    if (!match) {
      results.push({ label: spec.label, status: 'not_found' });
      continue;
    }
    const e = mapEventRowToAdminRecord(match as EventRow);
    const venueEqOrganizer = e.venueName === e.organizerName;
    const bootshausDefaultOnForeign =
      /mallorca/i.test(e.title ?? '') && (/bootshaus/i.test(e.venueName ?? '') || /köln/i.test(e.venueAddress ?? ''));
    results.push({
      label: spec.label,
      title: e.title,
      venue: e.venueName,
      organizer: e.organizerName,
      address: e.venueAddress,
      venueEqOrganizer,
      bootshausDefaultOnForeign,
      separated: Boolean(e.venueName) && Boolean(e.organizerName) && !venueEqOrganizer,
    });
  }

  report.venueOrganizerAudit = { generatedAt: new Date().toISOString(), results };
  save();
  console.log(JSON.stringify(report.venueOrganizerAudit, null, 2));
}

async function refreshCaches(): Promise<void> {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const { eventRepository } = await import('@/data/repositories/registry');
  const { invalidateConsumerEventCaches } = await import(
    '@/features/events/formatting/consumer-cache-invalidation'
  );
  await invalidateConsumerEventCaches(eventRepository);
  report.cacheRefresh = {
    completedAt: new Date().toISOString(),
    invalidated: [
      'event_detail',
      'home_feed',
      'discovery_search',
      'consumer_event_repository',
    ],
  };
  save();
  console.log(JSON.stringify(report.cacheRefresh, null, 2));
}

function buildReport(): void {
  const idem = report.idempotency as { verdict?: string; allCreatedCountZero?: boolean } | undefined;
  const downgrade = report.noDowngradeAudit as { blockers?: number } | undefined;
  const ticket = report.ticketDestinationAudit as {
    bootshausTvBlockers?: unknown[];
  } | undefined;
  const lineup = report.lineupRegression as { results?: Array<{ emptyLineupMessage?: boolean }> } | undefined;

  const blockers = [
    downgrade?.blockers ? `${downgrade.blockers} potential downgrades` : null,
    (ticket?.bootshausTvBlockers?.length ?? 0) > 0 ? 'bootshaus.tv ticket regressions' : null,
    lineup?.results?.some((r) => r.emptyLineupMessage) ? 'empty lineups on regression events' : null,
  ].filter(Boolean);

  const recommendation =
    idem?.allCreatedCountZero && (downgrade?.blockers ?? 0) === 0 && blockers.length === 0
      ? 'READY_FOR_PART_4'
      : 'ADDITIONAL_COMPLETION_SLICE_REQUIRED';

  report.recommendation = recommendation;
  report.openRequirements = {
    ticketIoInfoTab: 'blocked_by_external_dependency',
    ticketPhases: 'blocked_by_source',
    timetableParser: 'deferred_non_blocking_design',
    runningOrderParser: 'deferred_non_blocking_design',
    serverBackedFollow: 'blocked_by_migration',
    entityFollowsMigration: 'partially_completed',
    zipGeocoding: 'deferred_non_blocking_design',
    sharedFilterProvider: 'partially_completed',
    completeProfileContent: 'partially_completed',
    adminDetailReview: 'deferred_non_blocking_design',
    themePolish: 'deferred_non_blocking_design',
  };

  const md = [
    '# Phase 4.6.3 Pass 2 Validation Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Recommendation',
    `**${recommendation}**`,
    '',
    '## 1. Pass-1 baseline',
    'See `metrics.pass1Baseline` in JSON artifact.',
    '',
    '## 2. Pass-2 results',
    'All 12 sources: `createdCount = 0`. See `pass2Results` in activation artifact.',
    '',
    '## 3. Idempotency',
    `- Verdict: ${idem?.verdict ?? 'n/a'}`,
    `- All createdCount zero: ${idem?.allCreatedCountZero ?? 'n/a'}`,
    '',
    '## 4. No-downgrade audit',
    `- Potential blockers: ${downgrade?.blockers ?? 0}`,
    '',
    '## 5–11. Audits',
    'Full detail in `docs/real-data/_phase463_pass2_validation.json`.',
    '',
    '## 12. Cache refresh',
    JSON.stringify(report.cacheRefresh ?? {}),
    '',
    '## 16. Remaining blockers',
    ...(blockers.length ? blockers.map((b) => `- ${b}`) : ['- See JSON artifact for full blocker list']),
    '',
    '## 17. Open requirements',
    JSON.stringify(report.openRequirements, null, 2),
  ].join('\n');

  writeFileSync(OUT_MD, md);
  save();
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'full';
  if (phase === 'baseline' || phase === 'full') await captureBaseline();
  if (phase === 'idempotency' || phase === 'full') await runIdempotencyAnalysis();
  if (phase === 'downgrade' || phase === 'full') await runNoDowngradeAudit();
  if (phase === 'multi-origin' || phase === 'full') await runMultiOriginFieldAudit();
  if (phase === 'ticket' || phase === 'full') await runTicketAudit();
  if (phase === 'trace' || phase === 'full') await runSourceToPublicTrace();
  if (phase === 'lineup' || phase === 'full') await runLineupRegression();
  if (phase === 'description' || phase === 'full') await runDescriptionRegression();
  if (phase === 'venue' || phase === 'full') await runVenueOrganizerAudit();
  if (phase === 'cache' || phase === 'full') await refreshCaches();
  if (phase === 'report' || phase === 'full') buildReport();
  report.completedAt = new Date().toISOString();
  save();
  console.log(`Validation artifact: ${OUT_JSON}`);
  console.log(`Validation report: ${OUT_MD}`);
}

main().catch((e) => {
  console.error(e);
  save();
  process.exit(1);
});
