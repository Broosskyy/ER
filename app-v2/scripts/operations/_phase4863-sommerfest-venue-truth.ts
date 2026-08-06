/**
 * Phase 4.8.6.3 — Bootshaus Sommerfest venue truth trace (read-only).
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, mapEventRowToDomain, type EventRow } from '@/data/mappers/event-mapper';
import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { extractTicketIoEventSlug } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

export const PHASE4863_SOMMERFEST_EVENT_ID = 'evt-1785339391167-tfaixrr';
const WEBSITE_URL = 'https://bootshaus.tv/events/bootshaus-sommerfest';
const TICKET_URL = 'https://bootshaus-club.ticket.io/vB0cAmWg/';
const SHOP_LIST_URL = 'https://bootshaus-club.ticket.io/';
const BOOTSHAUS_ADDRESS = 'Auenweg 173';

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html',
};

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function readArtifact(name: string): unknown | undefined {
  const path = join(OUT, name);
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function fetchHtml(url: string): Promise<{ status: number; finalUrl: string; body: string }> {
  const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  return { status: res.status, finalUrl: res.url, body: res.ok ? await res.text() : '' };
}

function extractJsonLdVenues(html: string): Array<Record<string, unknown>> {
  const venues: Array<Record<string, unknown>> = [];
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const nodes = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') {
          continue;
        }
        const record = node as Record<string, unknown>;
        const type = String(record['@type'] ?? '');
        if (type.includes('Event')) {
          const location = record.location as Record<string, unknown> | undefined;
          if (location) {
            venues.push({
              eventName: record.name,
              venueName: location.name,
              address: location.address,
              url: record.url,
            });
          }
        }
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return venues;
}

function extractListRowTitle(html: string, slug: string): string | undefined {
  const match = html.match(new RegExp(`href=["']/?${slug}/?["'][^>]*>([^<]+)<`, 'i'));
  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

async function capturePublicTruth(): Promise<Record<string, unknown>> {
  const observedAt = new Date().toISOString();
  const [website, listPage, ticketPage] = await Promise.all([
    fetchHtml(WEBSITE_URL),
    fetchHtml(SHOP_LIST_URL),
    fetchHtml(TICKET_URL),
  ]);

  const slug = extractTicketIoEventSlug(TICKET_URL)!;
  const listRowTitle = extractListRowTitle(listPage.body, slug);
  const listJsonLd = extractJsonLdVenues(listPage.body).filter((v) =>
    String(v.url ?? '').includes(slug),
  );
  const parsed = parseTicketIoShopHtml(listPage.body, {
    shopSlug: 'bootshaus-club',
    listUrl: SHOP_LIST_URL,
    platform: 'ticket_io',
  });
  const connectorEvent = parsed.events.find(
    (e) => extractTicketIoEventSlug(e.ticketUrl) === slug,
  );
  const discovery = discoverTicketIoPriceEvidence({
    shopSlug: 'bootshaus-club',
    listUrl: SHOP_LIST_URL,
    listHtml: listPage.body,
    eventUrl: TICKET_URL,
  });

  const websiteVenueMentions = {
    essigfabrik: /essigfabrik/i.test(website.body),
    bootshaus: /bootshaus/i.test(website.body),
    auenweg173: website.body.includes(BOOTSHAUS_ADDRESS),
    explicitVenueBlock: /VENUE_NOT_PUBLISHED/i.test(website.body),
  };

  const evidence = [
    {
      source: 'bootshaus_official_page',
      url: WEBSITE_URL,
      httpStatus: website.status,
      venueText: null,
      address: websiteVenueMentions.auenweg173 ? BOOTSHAUS_ADDRESS : null,
      city: websiteVenueMentions.bootshaus ? 'Köln' : null,
      confidence: 'low',
      note: 'No explicit venue field on official page (phase 4.8.4/4.8.5 VENUE_NOT_PUBLISHED_ON_PAGE)',
      contentHash: hashContent(website.body.slice(0, 120_000)),
    },
    {
      source: 'ticket_io_list_row',
      url: SHOP_LIST_URL,
      httpStatus: listPage.status,
      venueText: connectorEvent?.venueName ?? listJsonLd[0]?.venueName,
      address: connectorEvent?.venueAddress ?? listJsonLd[0]?.address,
      city: connectorEvent?.cityName ?? 'Köln',
      listRowTitle,
      confidence: connectorEvent?.venueName ? 'high' : 'medium',
      contentHash: hashContent(listPage.body.slice(0, 120_000)),
    },
    {
      source: 'ticket_io_json_ld',
      url: SHOP_LIST_URL,
      matches: listJsonLd,
      confidence: listJsonLd.length > 0 ? 'high' : 'none',
    },
    {
      source: 'ticket_io_connector_parsed',
      venueName: connectorEvent?.venueName,
      venueAddress: connectorEvent?.venueAddress,
      cityName: connectorEvent?.cityName,
      latitude: connectorEvent?.latitude,
      longitude: connectorEvent?.longitude,
      title: connectorEvent?.title,
      startDate: connectorEvent?.startDate,
      confidence: connectorEvent?.venueName ? 'high' : 'none',
    },
    {
      source: 'ticket_io_event_page',
      url: TICKET_URL,
      httpStatus: ticketPage.status,
      altchaBlocked: /Security check/i.test(ticketPage.body),
      confidence: 'none',
      note: 'Detail page ALTCHA-blocked; list evidence used',
    },
  ];

  const result = {
    generatedAt: observedAt,
    phase: '4.8.6.3',
    productionMutationsInThisRun,
    eventId: PHASE4863_SOMMERFEST_EVENT_ID,
    discoveryBestHit: discovery.bestHit,
    evidence,
    inferredTrueVenue: connectorEvent?.venueName ?? listJsonLd[0]?.venueName ?? null,
    addressContradiction:
      connectorEvent?.venueName?.toLowerCase().includes('essigfabrik') &&
      String(connectorEvent?.venueAddress ?? '').includes(BOOTSHAUS_ADDRESS)
        ? 'venue_name_says_essigfabrik_but_address_is_bootshaus_auenweg_173'
        : null,
  };
  writeJson('_phase4863_public_truth.json', result);
  return result;
}

async function traceHistory(): Promise<Record<string, unknown>> {
  const client = opsClient();
  const { data: event } = await client
    .from('events')
    .select('*')
    .eq('id', PHASE4863_SOMMERFEST_EVENT_ID)
    .maybeSingle();
  const { data: refs } = await client
    .from('event_source_references')
    .select('*')
    .eq('canonical_event_id', PHASE4863_SOMMERFEST_EVENT_ID);
  const { data: imports } = await client
    .from('import_records')
    .select('*')
    .eq('resulting_event_id', PHASE4863_SOMMERFEST_EVENT_ID)
    .order('updated_at', { ascending: true });
  const { data: provenance } = await client
    .from('event_field_provenance')
    .select('*')
    .eq('event_id', PHASE4863_SOMMERFEST_EVENT_ID)
    .in('field_name', ['venueName', 'venue_name', 'venueCity', 'venueAddress']);
  const { data: origins } = await client
    .from('event_origins')
    .select('*')
    .eq('canonical_event_id', PHASE4863_SOMMERFEST_EVENT_ID);

  const ticketIoImport = (imports ?? []).find((r) =>
    String(r.source_id ?? '').includes('ticket-io'),
  );
  const normalized = ticketIoImport?.normalized_payload as Record<string, unknown> | undefined;
  const raw = ticketIoImport?.raw_payload as Record<string, unknown> | undefined;

  const pipeline = {
    officialPage: {
      url: WEBSITE_URL,
      venuePublished: false,
      diagnostic: 'VENUE_NOT_PUBLISHED_ON_PAGE',
      artifact: (readArtifact('_phase4841_full_website_validation.json') as {
        events?: Array<{ eventId: string; diagnostics?: unknown[] }>;
      })?.events?.find((e) => e.eventId === PHASE4863_SOMMERFEST_EVENT_ID)?.diagnostics,
    },
    websiteImporter: {
      venueCandidate: null,
      note: 'Unified website importer does not emit venue when not explicitly published',
    },
    normalizedPayload: normalized
      ? {
          venueName: normalized.venueName,
          venueAddress: normalized.venueAddress,
          cityName: normalized.cityName,
          sourceId: ticketIoImport?.source_id,
          updatedAt: ticketIoImport?.updated_at,
        }
      : null,
    importRecord: ticketIoImport
      ? {
          id: ticketIoImport.id,
          sourceId: ticketIoImport.source_id,
          status: ticketIoImport.status,
          updatedAt: ticketIoImport.updated_at,
        }
      : null,
    merge: {
      note: 'Phase 4.8.5 merge simulation shows no website venue candidate for Sommerfest; canonical venue retained from prior import',
    },
    canonicalEvent: event
      ? {
          venueName: event.venue_name,
          venueCity: event.city_name,
          venueAddress: event.venue_address,
          latitude: event.latitude,
          longitude: event.longitude,
          sourceId: event.source_id,
          updatedAt: event.updated_at,
        }
      : null,
    api: null as unknown,
    viewModel: null as unknown,
    consumerApp: null as unknown,
  };

  if (event) {
    const admin = mapEventRowToAdminRecord(event as EventRow);
    const projection = projectCanonicalEventFields({
      title: admin.title,
      description: admin.description ?? '',
      venue: admin.venueName ?? '',
      city: admin.venueCity ?? '',
      artists: [],
      priceText: admin.priceText,
      source: admin.sourceId ?? '',
      ticketUrl: admin.ticketUrl,
      imageUrl: admin.imageUrl,
      genres: admin.genreLabels,
      ticketStatus: admin.ticketStatus,
      ticketPhases: admin.ticketPhases,
      latitude: admin.latitude,
      longitude: admin.longitude,
    });
    pipeline.api = {
      venueLabel: projection.venueLabel,
      cityLabel: projection.cityLabel,
      locationLabelComma: projection.locationLabelComma,
      hasCoordinates: projection.hasCoordinates,
    };
    pipeline.viewModel = projection;
    pipeline.consumerApp = {
      locationLabelComma: projection.locationLabelComma,
      locationLabelDot: projection.locationLabelDot,
    };
  }

  const firstEssigfabrikStage =
    normalized?.venueName === 'Essigfabrik'
      ? 'ticket_io_import_normalized_payload'
      : event?.venue_name === 'Essigfabrik'
        ? 'canonical_event (predates trace artifacts)'
        : 'unknown';

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.3',
    productionMutationsInThisRun,
    eventId: PHASE4863_SOMMERFEST_EVENT_ID,
    pipeline,
    firstEssigfabrikStage,
    ticketIoImportAt: ticketIoImport?.updated_at,
    addressBootshausCoordsPresent:
      String(event?.venue_address ?? '').includes(BOOTSHAUS_ADDRESS) ||
      Number(event?.latitude) === 50.9517133,
    provenance: provenance ?? [],
    sourceReferences: refs ?? [],
    origins: origins ?? [],
    rawPayloadVenueSnippet: raw,
  };
  writeJson('_phase4863_historical_trace.json', result);
  return result;
}

async function auditVenueOwnership(): Promise<Record<string, unknown>> {
  const client = opsClient();
  const { data: event } = await client
    .from('events')
    .select('*')
    .eq('id', PHASE4863_SOMMERFEST_EVENT_ID)
    .maybeSingle();
  const { data: provenance } = await client
    .from('event_field_provenance')
    .select('*')
    .eq('event_id', PHASE4863_SOMMERFEST_EVENT_ID)
    .eq('field_name', 'venueName');

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.3',
    productionMutationsInThisRun,
    currentOwner: {
      eventSourceId: event?.source_id,
      venueName: event?.venue_name,
      likelyVenueOwner: 'ticket_io_import (source-bootshaus-ticket-io)',
      websiteOwnsVenue: false,
      organizerName: event?.organizer_name,
      organizerEqualsVenue: false,
    },
    rules: {
      organizerNotVenue: true,
      hostNotVenue: true,
      ticketShopNotVenue: 'VIOLATED — Ticket.io import wrote venueName without official page evidence',
      providerDefaultNotVenue: 'website importer correctly withheld venue',
      strongerEvidenceRequired: 'MISSING — no guard blocked ticket.io venue overwrite',
    },
    provenance: provenance ?? [],
  };
  writeJson('_phase4863_venue_ownership.json', result);
  return result;
}

function explainEssigfabrik(
  publicTruth: Record<string, unknown>,
  history: Record<string, unknown>,
): Record<string, unknown> {
  const inferred = (publicTruth as { inferredTrueVenue?: string }).inferredTrueVenue;
  const pipeline = (history as { pipeline?: { canonicalEvent?: { venueAddress?: string } } }).pipeline;
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.3',
    productionMutationsInThisRun,
    whyCanonicalSaysEssigfabrik:
      'Stale wrong Ticket Kings source references (Underland Essigfabrik) linked to this canonical Event on 2026-07-30; Essigfabrik venueName persisted and was not corrected when Ticket.io later imported venueName Bootshaus',
    earliestCause: 'wrong_source_reference_linkage',
    firstEssigfabrikStage:
      'event_source_references (2026-07-30) — ticketkings.de/event/underland-essigfabrik-05-09-2026/ linked to Bootshaus Sommerfest',
    notCausedBy: [
      'phase_4.8.6_website_controlled_publish (venue forbidden)',
      'official_website_importer (VENUE_NOT_PUBLISHED_ON_PAGE)',
      'current_ticket_io_list_evidence (today says Bootshaus)',
      'manual_repair_in_phase_486',
    ],
    internalContradiction: {
      venueName: 'Essigfabrik',
      venueAddress: pipeline?.canonicalEvent?.venueAddress,
      ticketIoImportVenueName: (
        history as { pipeline?: { normalizedPayload?: { venueName?: string } } }
      ).pipeline?.normalizedPayload?.venueName,
      note: 'Canonical label Essigfabrik contradicts Ticket.io import (Bootshaus) and address Auenweg 173',
    },
    publicTruthVenue: inferred,
    classification: 'canonical_venue_name_wrong_stale_essigfabrik_from_wrong_ticket_kings_linkage',
  };
  writeJson('_phase4863_root_cause.json', result);
  return result;
}

async function relatedEventCheck(): Promise<Record<string, unknown>> {
  const client = opsClient();
  const { data: events } = await client
    .from('events')
    .select('id,title,venue_name,venue_city,ticket_url,website_url,source_id,start_date')
    .eq('status', 'published')
    .or('title.ilike.%sommerfest%,title.ilike.%Sommerfest%');

  const related = (events ?? []).map((e) => ({
    eventId: e.id,
    title: e.title,
    venueName: e.venue_name,
    venueCity: e.venue_city,
    ticketUrl: e.ticket_url,
    websiteUrl: e.website_url,
    sourceId: e.source_id,
    startDate: e.start_date,
  }));

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.3',
    productionMutationsInThisRun,
    relatedEvents: related,
    contaminationAssessment: {
      sommerfestElektrokuecheSeparate: related.some((e) =>
        e.title?.toLowerCase().includes('elektroküche'),
      ),
      bootshausSommerfestUsesEssigfabrik: related.find(
        (e) => e.eventId === PHASE4863_SOMMERFEST_EVENT_ID,
      )?.venueName,
      sameTicketShopDifferentEvents: related.filter((e) =>
        e.ticketUrl?.includes('bootshaus-club.ticket.io'),
      ),
      venueLeakDetected:
        'No direct copy from Sommerfest Elektroküche; Essigfabrik likely from Ticket.io JSON-LD for vB0cAmWg slug',
    },
  };
  writeJson('_phase4863_related_events.json', result);
  return result;
}

function previewCorrection(publicTruth: Record<string, unknown>): Record<string, unknown> {
  const inferred = String((publicTruth as { inferredTrueVenue?: string }).inferredTrueVenue ?? '');
  const proposedVenue = inferred || 'Bootshaus';
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.3',
    productionMutationsInThisRun,
    executed: false,
    eventId: PHASE4863_SOMMERFEST_EVENT_ID,
    current: {
      venueName: 'Essigfabrik',
      venueCity: 'Köln',
      venueAddress: 'Auenweg 173, 51063 Köln',
    },
    proposed: {
      venueName: proposedVenue,
      venueCity: 'Köln',
      venueAddress: proposedVenue.toLowerCase().includes('bootshaus')
        ? 'Auenweg 173, 51063 Köln'
        : 'REVIEW_REQUIRED — align name with verified public address',
    },
    evidence: (publicTruth as { evidence?: unknown }).evidence,
    risk: proposedVenue.toLowerCase().includes('bootshaus') ? 'low' : 'medium',
    rollback: { venueName: 'Essigfabrik', venueCity: 'Köln' },
    frozenDomains: ['price', 'ticketUrl', 'description', 'lineup', 'genres', 'images', 'ownership'],
  };
  writeJson('_phase4863_correction_preview.json', result);
  return result;
}

async function globalVenueCollisionCheck(): Promise<Record<string, unknown>> {
  const client = opsClient();
  const { data: events } = await client
    .from('events')
    .select('id,title,venue_name,venue_city,venue_address,source_id,ticket_url')
    .eq('status', 'published')
    .not('venue_name', 'is', null);

  const byVenue = new Map<string, Array<Record<string, unknown>>>();
  for (const event of events ?? []) {
    const key = `${event.venue_name}|${event.venue_city ?? ''}`.toLowerCase();
    const list = byVenue.get(key) ?? [];
    list.push(event);
    byVenue.set(key, list);
  }

  const addressNameMismatches = (events ?? [])
    .filter((e) => {
      const name = String(e.venue_name ?? '').toLowerCase();
      const address = String(e.venue_address ?? '').toLowerCase();
      if (name.includes('essigfabrik') && address.includes('auenweg 173')) {
        return true;
      }
      if (name.includes('bootshaus') && address.includes('lichtstraße')) {
        return true;
      }
      return false;
    })
    .map((e) => ({
      eventId: e.id,
      title: e.title,
      venueName: e.venue_name,
      venueAddress: e.venue_address,
      issue: 'venue_name_address_mismatch',
    }));

  const copiedVenueClusters = [...byVenue.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      venueKey: key,
      eventCount: group.length,
      events: group.map((e) => ({ id: e.id, title: e.title, sourceId: e.source_id })),
    }))
    .filter((cluster) => cluster.eventCount >= 3)
    .slice(0, 20);

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.3',
    productionMutationsInThisRun,
    addressNameMismatches,
    copiedVenueClusters,
    sommerfestIncludedInMismatches: addressNameMismatches.some(
      (e) => e.eventId === PHASE4863_SOMMERFEST_EVENT_ID,
    ),
  };
  writeJson('_phase4863_global_venue_collisions.json', result);
  return result;
}

async function report(): Promise<void> {
  console.log(
    JSON.stringify(
      {
        phase: '4.8.6.3',
        productionMutationsInThisRun,
        eventId: PHASE4863_SOMMERFEST_EVENT_ID,
      },
      null,
      2,
    ),
  );
}

async function full(): Promise<void> {
  const publicTruth = await capturePublicTruth();
  const history = await traceHistory();
  await auditVenueOwnership();
  explainEssigfabrik(publicTruth, history);
  await relatedEventCheck();
  previewCorrection(publicTruth);
  await globalVenueCollisionCheck();
  await report();
}

const command = process.argv[2] ?? 'full';
const handlers: Record<string, () => Promise<void>> = {
  'capture-public-truth': async () => {
    await capturePublicTruth();
  },
  'trace-history': async () => {
    await traceHistory();
  },
  'audit-venue-ownership': async () => {
    await auditVenueOwnership();
  },
  'explain-root-cause': async () => {
    const publicTruth =
      (readArtifact('_phase4863_public_truth.json') as Record<string, unknown>) ??
      (await capturePublicTruth());
    const history =
      (readArtifact('_phase4863_historical_trace.json') as Record<string, unknown>) ??
      (await traceHistory());
    explainEssigfabrik(publicTruth, history);
  },
  'related-events': async () => {
    await relatedEventCheck();
  },
  'preview-correction': async () => {
    const publicTruth =
      (readArtifact('_phase4863_public_truth.json') as Record<string, unknown>) ??
      (await capturePublicTruth());
    previewCorrection(publicTruth);
  },
  'global-venue-collisions': async () => {
    await globalVenueCollisionCheck();
  },
  report: async () => {
    await report();
  },
  full: async () => {
    await full();
  },
};

const handler = handlers[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

handler()
  .then(() => {
    console.log(`phase4863 ${command} complete; productionMutationsInThisRun=${productionMutationsInThisRun}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
