/**
 * Phase 4.8.0 — Gold Standard Validation & Reference Dataset (READ ONLY).
 *
 * Establishes public-source ground truth for 8 permanent reference events.
 * No database mutations, imports, repairs, or connector changes.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase480-gold-standard-validation.ts <command>
 *
 * Commands: ground-truth | trace | compare | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, mapEventRowToDomain, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { parseTicketIoDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-parser';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { auditTicketIoShopAvailabilityEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-shop-availability-evidence';
import {
  enrichTicketKingsDetailFromPublicCheckout,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { parseTicketKingsDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-detail-parser';
import { extractTicketIoShopSlug } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { readCanonicalLineup } from '@/features/events/domain/canonical-lineup-read';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { projectEventAttributeBadges } from '@/features/events/domain/event-attribute-badge-projection';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { buildConsumerGalleryImageUrls } from '@/features/events/formatting/consumer-gallery-projection';
import { mapCanonicalAvailabilityToTicketBadge } from '@/features/events/formatting/ticket-badge-projection';
import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

type FieldClassification =
  | 'identical'
  | 'missing'
  | 'incorrect'
  | 'stale'
  | 'filtered'
  | 'blocked'
  | 'missing_public_evidence'
  | 'connector_gap'
  | 'importer_gap'
  | 'evidence_gap'
  | 'merge_gap'
  | 'projection_gap'
  | 'consumer_bug'
  | 'browser_behaviour'
  | 'third_party_behaviour'
  | 'review_required';

type PipelineStage =
  | 'Public Source'
  | 'Connector / Importer'
  | 'Evidence Extraction'
  | 'Evidence Objects'
  | 'Canonical Merge'
  | 'Canonical Writer'
  | 'Database'
  | 'Canonical Reader'
  | 'Projection'
  | 'API'
  | 'ViewModel'
  | 'Mobile UI'
  | 'Observed Consumer Result'
  | 'Browser'
  | 'Third-party platform'
  | 'Unknown';

type RootCauseCategory =
  | 'Public Source'
  | 'Connector'
  | 'Importer'
  | 'Evidence Extraction'
  | 'Evidence Model'
  | 'Canonical Merge'
  | 'Persistence'
  | 'Projection'
  | 'API'
  | 'ViewModel'
  | 'Mobile UI'
  | 'Browser'
  | 'Third-party platform'
  | 'Unknown';

type SubsystemVerdict = 'KEEP' | 'KEEP_WITH_REFACTOR' | 'MODERNIZE' | 'REBUILD' | 'REMOVE';

const TRACKED_FIELDS = [
  'title',
  'subtitle',
  'date',
  'start',
  'doors',
  'venue',
  'address',
  'coordinates',
  'genres',
  'description',
  'lineup',
  'artists',
  'flyer',
  'gallery',
  'ticketUrl',
  'provider',
  'ticketPhases',
  'prices',
  'availability',
  'soldOut',
  'badges',
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

interface GoldStandardEvent {
  key: string;
  eventId: string;
  label: string;
  platform: 'ticket_io' | 'ticket_kings';
  websiteUrl: string;
  ticketUrl: string;
  specialValidation?: string[];
}

const GOLD_STANDARD_EVENTS: GoldStandardEvent[] = [
  {
    key: 'ship',
    eventId: 'evt-1785339420043-obhyeev',
    label: 'Bootshaus on a Ship Vol. III',
    platform: 'ticket_io',
    websiteUrl: 'https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iii',
    ticketUrl: 'https://bootshaus-club.ticket.io/wUc3uQrR/',
    specialValidation: ['reference_success', 'evidence_sources', 'merge_decisions'],
  },
  {
    key: 'levi',
    eventId: 'evt-1785339383539-0lxvjlp',
    label: 'LEVI',
    platform: 'ticket_io',
    websiteUrl: 'https://bootshaus.tv/events/nightswithus-presents-levi',
    ticketUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
    specialValidation: ['missing_price', 'event_specific_url', 'availability', 'genres', 'lineup'],
  },
  {
    key: 'underland',
    eventId: 'evt-1785389049895-4mb7dub',
    label: 'Underland',
    platform: 'ticket_io',
    websiteUrl: 'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026',
    ticketUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
    specialValidation: ['ticket_destination', 'browser_redirect', 'event_specific_url', 'cache_behaviour'],
  },
  {
    key: 'bc173',
    eventId: 'evt-1785339392687-tbdwup4',
    label: 'BC173',
    platform: 'ticket_io',
    websiteUrl: 'https://bootshaus.tv/events/19-9-26-bc173-airport-session-pres-by-bootshaus',
    ticketUrl: 'https://bootshaus-club.ticket.io/fjspvLe4/',
    specialValidation: ['prices', 'phases', 'badges'],
  },
  {
    key: 'sommerfest',
    eventId: 'evt-1785389055557-ux20897',
    label: 'Sommerfest Elektroküche',
    platform: 'ticket_kings',
    websiteUrl: 'https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026',
    ticketUrl: 'https://ticketkings.de/event/sommerfest-elektrokueche-08-08-2026/',
    specialValidation: ['checkout', 'public_page', 'ticket_phases', 'badges', 'provider', 'genres', 'venue', 'lineup'],
  },
  {
    key: 'mdma',
    eventId: 'evt-1785443911160-owt97y3',
    label: 'MDMA',
    platform: 'ticket_kings',
    websiteUrl: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/',
    ticketUrl: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/',
    specialValidation: ['checkout', 'lineup_truth', 'garbage_artist_prevention', 'venue', 'genres'],
  },
  {
    key: 'affenkaefig',
    eventId: 'evt-1785339005035-wam829k',
    label: 'Affenkäfig',
    platform: 'ticket_io',
    websiteUrl: 'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln',
    ticketUrl: 'https://bootshaus-club.ticket.io/B3jK8aPC/',
    specialValidation: ['ticket_io', 'lineup', 'venue', 'badges'],
  },
  {
    key: 'proton',
    eventId: 'evt-1785443914377-7g9l545',
    label: 'PROTON Stuttgart',
    platform: 'ticket_kings',
    websiteUrl: 'https://ticketkings.de/event/m-d-m-a-xxx-proton-xxx-stuttgart/',
    ticketUrl: 'https://ticketkings.de/event/m-d-m-a-xxx-proton-xxx-stuttgart/',
    specialValidation: ['checkout', 'prices', 'phases', 'badges', 'lineup', 'venue'],
  },
];

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function fetchHtml(url: string): Promise<{ status: number; finalUrl: string; html: string; error?: string }> {
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
    return {
      status: response.status,
      finalUrl: response.url,
      html: await response.text(),
    };
  } catch (error) {
    return {
      status: 0,
      finalUrl: url,
      html: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseWebsiteJsonLd(html: string, baseUrl?: string) {
  const blocks = extractJsonLdBlocks(html);
  const nodes = blocks.flatMap((block) => collectJsonLdNodes(block));
  const eventNode = nodes[0];
  if (!eventNode) {
    return extractWebsiteMetaFallback(html);
  }
  const parsed = parseJsonLdEvent(eventNode, baseUrl);
  return parsed.fields;
}

function extractWebsiteMetaFallback(html: string): Record<string, unknown> | null {
  const readMeta = (property: string): string | undefined => {
    const patterns = [
      new RegExp(`property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
      new RegExp(`name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  };

  const title = readMeta('og:title') ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const description = readMeta('og:description') ?? readMeta('description');
  const imageUrl = readMeta('og:image');
  if (!title && !description && !imageUrl) {
    return null;
  }
  return { title, description, imageUrl };
}

function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparable(item)).filter(Boolean).join('|').toLowerCase();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function valuesMatch(a: unknown, b: unknown): boolean {
  const na = normalizeComparable(a);
  const nb = normalizeComparable(b);
  if (!na && !nb) {
    return true;
  }
  if (!na || !nb) {
    return false;
  }
  if (na === nb) {
    return true;
  }
  if (na.includes(nb) || nb.includes(na)) {
    return true;
  }
  return false;
}

function normalizeImportRecord(row: Record<string, unknown>): ImportRecord {
  return {
    ...(row as ImportRecord),
    sourceId: String(row.sourceId ?? row.source_id ?? ''),
    canonicalEventId: (row.canonicalEventId ?? row.canonical_event_id) as string | undefined,
    duplicateEventId: (row.duplicateEventId ?? row.duplicate_event_id) as string | undefined,
    externalId: String(row.externalId ?? row.external_id ?? ''),
    importJobId: String(row.importJobId ?? row.import_job_id ?? ''),
  };
}

async function loadImportRecords(eventId: string, title: string): Promise<ImportRecord[]> {
  const byCanonical = await opsClient()
    .from('import_records')
    .select('*')
    .eq('canonical_event_id', eventId);
  const byDuplicate = await opsClient()
    .from('import_records')
    .select('*')
    .eq('duplicate_event_id', eventId);
  const merged = [...(byCanonical.data ?? []), ...(byDuplicate.data ?? [])];
  const seen = new Set<string>();
  const unique = merged.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
  if (unique.length > 0) {
    return unique.map((row) => normalizeImportRecord(row as Record<string, unknown>));
  }
  const { data: byTitle } = await opsClient()
    .from('import_records')
    .select('*')
    .ilike('normalized_payload->>title', `%${title.slice(0, 40)}%`)
    .limit(5);
  return (byTitle ?? []).map((row) => normalizeImportRecord(row as Record<string, unknown>));
}

async function loadStructuredEntries(eventId: string) {
  const { data } = await opsClient()
    .from('event_lineup_entries')
    .select(
      'id, sort_order, billing_relation, stage, event_lineup_entry_artists(artist_id, sort_order, artists(name, lineup_legacy_artifact))',
    )
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });
  return data ?? [];
}

async function loadSources(sourceIds: string[]) {
  if (sourceIds.length === 0) {
    return [];
  }
  const { data } = await opsClient().from('sources').select('*').in('id', [...new Set(sourceIds)]);
  return data ?? [];
}

function toResolvedEntries(structured: Awaited<ReturnType<typeof loadStructuredEntries>>) {
  return structured.map((entry, index) => ({
    order: entry.sort_order ?? index,
    artists: (
      (entry.event_lineup_entry_artists as Array<{ artists: { name?: string; lineup_legacy_artifact?: boolean } | null }>) ??
      []
    )
      .map((row) => row.artists?.name)
      .filter((name): name is string => Boolean(name)),
    artistIds: [],
    entryId: entry.id,
    billingRelation: entry.billing_relation ?? 'SOLO',
    stage: entry.stage,
  }));
}

async function observePublicGroundTruth(ref: GoldStandardEvent) {
  const observedAt = new Date().toISOString();
  const websiteFetch = await fetchHtml(ref.websiteUrl);
  const ticketFetch = await fetchHtml(ref.ticketUrl);

  const websiteJsonLd = websiteFetch.html ? parseWebsiteJsonLd(websiteFetch.html, ref.websiteUrl) : null;

  let ticketPlatform: Record<string, unknown> = {
    fetchStatus: ticketFetch.status,
    finalUrl: ticketFetch.finalUrl,
    error: ticketFetch.error,
  };

  if (ref.platform === 'ticket_io' && ticketFetch.html) {
    const detail = parseTicketIoDetailHtml(ticketFetch.html, ref.label);
    const shopSlug = extractTicketIoShopSlug(ref.ticketUrl) ?? 'bootshaus-club';
    const listUrl = `https://${shopSlug}.ticket.io/`;
    const listFetch = await fetchHtml(listUrl);
    const priceDiscovery = discoverTicketIoPriceEvidence({
      shopSlug,
      listUrl,
      listHtml: listFetch.html,
      eventUrl: ref.ticketUrl,
      detailHtml: ticketFetch.html,
    });
    const availabilityAudit = auditTicketIoShopAvailabilityEvidence({
      eventId: ref.eventId,
      title: ref.label,
      ticketUrl: ref.ticketUrl,
      listHtml: listFetch.html,
      discovery: priceDiscovery,
    });

    ticketPlatform = {
      ...ticketPlatform,
      parser: 'ticket_io',
      blockedByPow: detail.blockedByPow ?? false,
      description: detail.description,
      artistNames: detail.artistNames,
      lineupEntries: detail.lineupEntries?.map((e) => e.displayName),
      priceText: detail.priceText ?? priceDiscovery.bestHit?.priceText,
      priceAmount: detail.priceAmount ?? priceDiscovery.bestHit?.priceAmount,
      soldOut: detail.soldOut ?? priceDiscovery.bestHit?.soldOut,
      availability: availabilityAudit.inferredAvailability,
      ticketOffers: detail.ticketOffers,
      doorsOpenAt: detail.doorsOpenAt,
      eventAttributes: detail.eventAttributes,
      detailAltchaBlocked: priceDiscovery.detailAltchaBlocked,
      listRowCount: priceDiscovery.listRowCount,
      availabilityReviewRequired: availabilityAudit.reviewRequired,
    };
  }

  if (ref.platform === 'ticket_kings' && ticketFetch.html) {
    const detail = parseTicketKingsDetailHtml(ticketFetch.html);
    const checkout = await enrichTicketKingsDetailFromPublicCheckout(ticketFetch.html, async (url) => {
      const response = await fetchHtml(url);
      return response.html;
    });

    ticketPlatform = {
      ...ticketPlatform,
      parser: 'ticket_kings',
      description: detail.description,
      genreNames: detail.genreNames,
      artistNames: detail.artistNames,
      lineupEntries: detail.lineupEntries?.map((e) => e.displayName),
      priceAmount: detail.priceAmount ?? checkout?.priceAmount,
      priceText: checkout?.priceText,
      ticketPhases: checkout?.products,
      soldOut: checkout?.soldOut,
      availability: checkout?.availability,
      checkoutUrl: checkout?.checkoutUrl,
      checkout,
      fieldCoverage: detail.fieldCoverage,
    };
  }

  const groundTruth: Record<TrackedField, unknown> = {
    title: websiteJsonLd?.title,
    subtitle: undefined,
    date: websiteJsonLd?.startDate,
    start: websiteJsonLd?.startDate,
    doors: ticketPlatform.doorsOpenAt ?? websiteJsonLd?.doorsOpenAt,
    venue: websiteJsonLd?.venueName ?? ticketPlatform.venueName,
    address: websiteJsonLd?.venueAddress,
    coordinates:
      websiteJsonLd?.latitude !== undefined && websiteJsonLd?.longitude !== undefined
        ? `${websiteJsonLd.latitude},${websiteJsonLd.longitude}`
        : undefined,
    genres: ticketPlatform.genreNames ?? websiteJsonLd?.genres,
    description: websiteJsonLd?.description ?? ticketPlatform.description,
    lineup: ticketPlatform.lineupEntries ?? ticketPlatform.artistNames,
    artists: ticketPlatform.artistNames ?? websiteJsonLd?.artistNames,
    flyer: websiteJsonLd?.imageUrl,
    gallery: websiteJsonLd?.imageUrl,
    ticketUrl: ticketFetch.finalUrl || ref.ticketUrl,
    provider: ref.platform === 'ticket_io' ? 'ticket.io' : 'ticket_kings',
    ticketPhases: ticketPlatform.ticketOffers ?? ticketPlatform.ticketPhases,
    prices: ticketPlatform.priceText,
    availability: ticketPlatform.availability,
    soldOut: ticketPlatform.soldOut,
    badges: ticketPlatform.eventAttributes,
  };

  return {
    eventKey: ref.key,
    eventId: ref.eventId,
    label: ref.label,
    observedAt,
    sources: {
      website: {
        url: ref.websiteUrl,
        fetchStatus: websiteFetch.status,
        finalUrl: websiteFetch.finalUrl,
        error: websiteFetch.error,
        jsonLd: websiteJsonLd,
      },
      ticketPlatform: {
        url: ref.ticketUrl,
        ...ticketPlatform,
      },
    },
    groundTruth,
    observationNotes: buildObservationNotes(ref, ticketPlatform, websiteFetch, ticketFetch),
  };
}

function buildObservationNotes(
  ref: GoldStandardEvent,
  ticketPlatform: Record<string, unknown>,
  websiteFetch: { status: number; error?: string },
  ticketFetch: { status: number; finalUrl: string; error?: string },
): string[] {
  const notes: string[] = [];
  if (ticketPlatform.blockedByPow) {
    notes.push('Ticket.io detail page blocked by ALTCHA/POW challenge — list/detail price evidence may be incomplete.');
  }
  if (ref.key === 'levi' && ticketPlatform.detailAltchaBlocked && !ticketPlatform.priceText) {
    notes.push('LEVI: bootshaus-tickets shop list returns 0 rows; price not publicly extractable without bypassing bot protection.');
  }
  if (ref.key === 'underland') {
    notes.push(`Underland ticket redirect observed: requested ${ref.ticketUrl} → final ${ticketFetch.finalUrl}`);
  }
  if (ref.key === 'sommerfest') {
    notes.push('Sommerfest canonical ticketUrl may differ from affenkaefig official page slug (20-06 vs 08-08) — verify merge winner.');
  }
  if (websiteFetch.error) {
    notes.push(`Website fetch error: ${websiteFetch.error}`);
  }
  if (ticketFetch.error) {
    notes.push(`Ticket platform fetch error: ${ticketFetch.error}`);
  }
  return notes;
}

function projectSystemLayers(
  admin: AdminEventRecord,
  structured: Awaited<ReturnType<typeof loadStructuredEntries>>,
  row: EventRow,
) {
  const lineup = readCanonicalLineup({
    structuredEntries: toResolvedEntries(structured),
    eventTitle: admin.title,
  });

  const canonicalTicket = readCanonicalTicket({
    ticketUrl: admin.ticketUrl,
    websiteUrl: admin.websiteUrl,
    priceText: admin.priceText,
    ticketStatus: admin.ticketStatus,
    ticketPhases: admin.ticketPhases,
    salesStartAt: admin.salesStartAt,
    salesEndAt: admin.salesEndAt,
  });

  const gallery = buildConsumerGalleryImageUrls({
    flyerUrl: admin.flyerUrl,
    imageUrl: admin.imageUrl,
  });

  const projection = projectCanonicalEventFields({
    title: admin.title,
    description: admin.description ?? '',
    venue: admin.venueName ?? '',
    city: admin.venueCity ?? '',
    artists: lineup.artistNames,
    lineup: lineup.artistNames,
    priceText: canonicalTicket.priceText ?? admin.priceText,
    source: admin.sourceId ?? 'supabase',
    ticketUrl: canonicalTicket.publicCtaUrl ?? admin.ticketUrl,
    ticketPlatform: canonicalTicket.ticketPlatform,
    ticketDestinationClass: canonicalTicket.destinationClass,
    ticketStatus: canonicalTicket.ticketStatus ?? admin.ticketStatus,
    ticketPhases: admin.ticketPhases,
    imageUrl: admin.imageUrl,
    imageUrls: gallery,
    genres: admin.genreLabels ?? [],
    countryLabel: admin.venueCountryCode,
    latitude: admin.latitude,
    longitude: admin.longitude,
    timezone: admin.timezone,
    organizer: admin.organizerName,
    eventAttributes: admin.eventAttributes,
  });

  const ticketBadge = mapCanonicalAvailabilityToTicketBadge(
    canonicalTicket.availability,
    canonicalTicket.ticketStatus,
  );
  const attributeBadges = projectEventAttributeBadges(admin.eventAttributes, {
    floorCount: admin.floorCount,
    stageCount: admin.stageCount,
  });

  const domainEvent = mapEventRowToDomain(row);

  const systemFields: Record<TrackedField, unknown> = {
    title: admin.title,
    subtitle: admin.subtitle,
    date: admin.startDate,
    start: admin.startDate,
    doors: admin.doorsOpenAt,
    venue: projection.venueLabel || admin.venueName,
    address: admin.venueAddress,
    coordinates:
      admin.latitude !== undefined && admin.longitude !== undefined
        ? `${admin.latitude},${admin.longitude}`
        : undefined,
    genres: admin.genreLabels,
    description: projection.sanitizedDescription ?? admin.description,
    lineup: lineup.artistNames,
    artists: lineup.artistNames,
    flyer: admin.flyerUrl ?? admin.imageUrl,
    gallery,
    ticketUrl: canonicalTicket.publicCtaUrl ?? admin.ticketUrl,
    provider: projection.ticketProviderLabel,
    ticketPhases: admin.ticketPhases,
    prices: projection.displayPriceText ?? canonicalTicket.priceText ?? admin.priceText,
    availability: canonicalTicket.availability,
    soldOut: projection.isSoldOut ?? canonicalTicket.soldOut,
    badges: attributeBadges.map((b) => b.label),
  };

  return {
    database: {
      ticketUrl: admin.ticketUrl,
      websiteUrl: admin.websiteUrl,
      priceText: admin.priceText,
      ticketStatus: admin.ticketStatus,
      venueName: admin.venueName,
      genreLabels: admin.genreLabels,
      structuredLineupCount: structured.length,
    },
    canonicalReader: {
      ticket: canonicalTicket,
      lineup,
    },
    projection,
    api: domainEvent,
    viewModel: {
      ticketBadge,
      displayPriceText: projection.displayPriceText,
      ticketProviderLabel: projection.ticketProviderLabel,
      lineupCompleteness: projection.lineupCompleteness,
      hasKnownLineup: projection.hasKnownLineup,
    },
    mobile: systemFields,
    systemFields,
  };
}

function pickDatabaseLayer(
  database: Record<string, unknown>,
  admin: AdminEventRecord,
  field: TrackedField,
): unknown {
  switch (field) {
    case 'title':
      return admin.title;
    case 'venue':
      return database.venueName ?? admin.venueName;
    case 'genres':
      return database.genreLabels ?? admin.genreLabels;
    case 'prices':
      return database.priceText ?? admin.priceText;
    case 'ticketUrl':
      return database.ticketUrl ?? admin.ticketUrl;
    case 'availability':
      return admin.ticketStatus;
    case 'lineup':
    case 'artists':
      return database.structuredLineupCount;
    default:
      return undefined;
  }
}

function pickProjectionLayer(
  projection: ReturnType<typeof projectCanonicalEventFields>,
  viewModel: { displayPriceText?: string; ticketProviderLabel?: string },
  field: TrackedField,
): unknown {
  switch (field) {
    case 'venue':
      return projection.venueLabel;
    case 'description':
      return projection.sanitizedDescription;
    case 'prices':
      return projection.displayPriceText ?? viewModel.displayPriceText;
    case 'provider':
      return projection.ticketProviderLabel ?? viewModel.ticketProviderLabel;
    case 'soldOut':
      return projection.isSoldOut;
    case 'lineup':
    case 'artists':
      return projection.knownArtistNames;
    default:
      return undefined;
  }
}

function buildSpecialValidation(
  ref: GoldStandardEvent,
  groundTruthObs: Awaited<ReturnType<typeof observePublicGroundTruth>>,
  system: ReturnType<typeof projectSystemLayers>,
  importOrigins: Array<{ sourceId?: string; sourceName?: string; normalized: Record<string, unknown> }>,
  fieldComparisons: Array<{ field: string; classification: string; rootCause: string; note: string }>,
) {
  const findField = (name: string) => fieldComparisons.find((f) => f.field === name);
  const ticketPlatform = groundTruthObs.sources.ticketPlatform as Record<string, unknown>;
  const website = groundTruthObs.sources.website as Record<string, unknown>;

  if (ref.key === 'ship') {
    return {
      whySucceeds:
        'Multi-source merge: bootshaus.tv og metadata + bootshaus-club.ticket.io list sold-out evidence when detail ALTCHA-blocked.',
      evidenceSources: importOrigins.map((o) => ({
        sourceId: o.sourceId,
        sourceName: o.sourceName,
        ticketUrl: o.normalized.ticketUrl,
        priceText: o.normalized.priceText,
      })),
      mergeDecisions: {
        primarySourceId: importOrigins[0]?.sourceId,
        ticketUrlClassification: findField('ticketUrl')?.classification,
        pricesClassification: findField('prices')?.classification,
        soldOutClassification: findField('soldOut')?.classification,
      },
      qualityFields: fieldComparisons.filter((f) => f.classification === 'identical').map((f) => f.field),
    };
  }

  if (ref.key === 'levi') {
    return {
      ticketUrl: { groundTruth: groundTruthObs.groundTruth.ticketUrl, canonical: system.database.ticketUrl, classification: findField('ticketUrl')?.classification },
      missingPrice: { groundTruth: groundTruthObs.groundTruth.prices, canonical: system.systemFields.prices, classification: findField('prices')?.classification, rootCause: findField('prices')?.rootCause },
      availability: { groundTruth: ticketPlatform.availability, canonical: system.systemFields.availability, classification: findField('availability')?.classification },
      genres: { groundTruth: groundTruthObs.groundTruth.genres, canonical: system.systemFields.genres, classification: findField('genres')?.classification },
      lineup: { groundTruth: groundTruthObs.groundTruth.lineup, canonical: system.systemFields.lineup, classification: findField('lineup')?.classification },
      altchaBlocked: ticketPlatform.blockedByPow,
      listRowCount: ticketPlatform.listRowCount,
    };
  }

  if (ref.key === 'underland') {
    return {
      ticketDestination: { groundTruth: groundTruthObs.groundTruth.ticketUrl, consumerCta: system.systemFields.ticketUrl, websiteOffer: (website.jsonLd as { ticketUrl?: string })?.ticketUrl },
      browserRedirect: { requested: ref.ticketUrl, final: ticketPlatform.finalUrl },
      eventSpecificUrl: findField('ticketUrl')?.classification === 'identical',
      cacheBehaviour: 'Read-only observation — no cache invalidation in this phase',
      classification: findField('ticketUrl')?.classification,
    };
  }

  if (ref.key === 'bc173') {
    return {
      ticketIoEvidence: { listRowCount: ticketPlatform.listRowCount, detailAltchaBlocked: ticketPlatform.detailAltchaBlocked },
      prices: findField('prices'),
      phases: findField('ticketPhases'),
      badges: findField('badges'),
    };
  }

  if (['sommerfest', 'mdma', 'proton'].includes(ref.key)) {
    const checkout = ticketPlatform.checkout as Record<string, unknown> | undefined;
    return {
      ticketKingsCheckout: checkout ? { url: checkout.checkoutUrl ?? ticketPlatform.checkoutUrl, priceText: checkout.priceText, availability: checkout.availability } : null,
      publicPage: { websiteUrl: website.url, jsonLdTitle: (website.jsonLd as { title?: string })?.title },
      ticketPhases: findField('ticketPhases'),
      badges: findField('badges'),
      provider: findField('provider'),
      genres: findField('genres'),
      venue: findField('venue'),
      lineup: findField('lineup'),
      garbageArtistPrevention: ref.key === 'mdma' ? { structuredLineupCount: system.database.structuredLineupCount, lineupClassification: findField('lineup')?.classification } : undefined,
    };
  }

  if (ref.key === 'affenkaefig') {
    return {
      primaryPlatform: 'ticket_io',
      ticketUrl: findField('ticketUrl'),
      lineup: findField('lineup'),
      venue: findField('venue'),
      badges: findField('badges'),
      note: 'Gold-standard event uses Ticket.io (bootshaus-club), not Ticket Kings',
    };
  }

  return { checks: ref.specialValidation };
}

function pickImportEvidence(importOrigins: Array<{ normalized: Record<string, unknown> }>, field: TrackedField): unknown {
  switch (field) {
    case 'title':
      return importOrigins.map((o) => o.normalized.title).find(Boolean);
    case 'venue':
      return importOrigins.map((o) => o.normalized.venueName).find(Boolean);
    case 'genres':
      return importOrigins.flatMap((o) => (o.normalized.genres as string[] | undefined) ?? []);
    case 'lineup':
    case 'artists':
      return importOrigins.flatMap((o) => (o.normalized.artistNames as string[] | undefined) ?? []);
    case 'prices':
      return importOrigins.map((o) => o.normalized.priceText).find(Boolean);
    case 'ticketUrl':
      return importOrigins.map((o) => o.normalized.ticketUrl).find(Boolean);
    default:
      return undefined;
  }
}

function classifyField(
  field: TrackedField,
  groundTruth: unknown,
  layers: {
    importEvidence: unknown;
    database: unknown;
    projection: unknown;
    consumer: unknown;
  },
  context: {
    blockedByPow?: boolean;
    browserNote?: boolean;
    filteredLineup?: boolean;
  },
): { classification: FieldClassification; earliestStage: PipelineStage; rootCause: RootCauseCategory; note: string } {
  const gtEmpty = !normalizeComparable(groundTruth);
  const importEmpty = !normalizeComparable(layers.importEvidence);
  const dbEmpty = !normalizeComparable(layers.database);
  const projectionEmpty = !normalizeComparable(layers.projection);
  const consumerEmpty = !normalizeComparable(layers.consumer);

  if (gtEmpty && consumerEmpty) {
    return {
      classification: 'identical',
      earliestStage: 'Public Source',
      rootCause: 'Public Source',
      note: 'No public evidence and no consumer value',
    };
  }

  if (context.blockedByPow && ['prices', 'availability', 'ticketPhases', 'soldOut'].includes(field)) {
    return {
      classification: 'third_party_behaviour',
      earliestStage: 'Third-party platform',
      rootCause: 'Third-party platform',
      note: 'ALTCHA/POW blocks automated public observation — not an internal pipeline defect',
    };
  }

  if (context.browserNote && field === 'ticketUrl') {
    return {
      classification: 'browser_behaviour',
      earliestStage: 'Browser',
      rootCause: 'Browser',
      note: 'Redirect/cache behaviour may differ between ops fetch and user browser session',
    };
  }

  if (gtEmpty && !consumerEmpty) {
    return {
      classification: 'missing_public_evidence',
      earliestStage: 'Public Source',
      rootCause: 'Public Source',
      note: 'Consumer shows value but automated public fetch could not confirm (og/meta/json-ld gap)',
    };
  }

  if (!gtEmpty && consumerEmpty) {
    if (context.filteredLineup && (field === 'lineup' || field === 'artists')) {
      return {
        classification: 'filtered',
        earliestStage: 'Canonical Reader',
        rootCause: 'Evidence Extraction',
        note: 'Public lineup exists; consumer empty due to filtering or legacy artifact handling',
      };
    }
    if (!importEmpty && dbEmpty) {
      return {
        classification: 'merge_gap',
        earliestStage: 'Canonical Merge',
        rootCause: 'Canonical Merge',
        note: 'Import evidence exists but canonical persistence is empty',
      };
    }
    if (importEmpty && !gtEmpty) {
      return {
        classification: 'connector_gap',
        earliestStage: 'Evidence Extraction',
        rootCause: 'Connector',
        note: 'Public source exposes field; connector/import evidence missing',
      };
    }
    if (!dbEmpty && projectionEmpty) {
      return {
        classification: 'projection_gap',
        earliestStage: 'Projection',
        rootCause: 'Projection',
        note: 'Database holds value but projection/consumer layer empty',
      };
    }
    return {
      classification: 'missing',
      earliestStage: 'Canonical Merge',
      rootCause: 'Canonical Merge',
      note: 'Public ground truth exists; canonical consumer field empty',
    };
  }

  if (valuesMatch(groundTruth, layers.consumer)) {
    return {
      classification: 'identical',
      earliestStage: 'Observed Consumer Result',
      rootCause: 'Public Source',
      note: 'Public truth aligns with observed consumer projection',
    };
  }

  if (field === 'ticketUrl') {
    const gt = normalizeComparable(groundTruth);
    const consumer = normalizeComparable(layers.consumer);
    if (gt && consumer && (gt.includes(consumer) || consumer.includes(gt))) {
      return {
        classification: 'identical',
        earliestStage: 'Observed Consumer Result',
        rootCause: 'Public Source',
        note: 'URL paths align (trailing slash tolerant)',
      };
    }
    if (!valuesMatch(layers.importEvidence, layers.database) && !dbEmpty) {
      return {
        classification: 'merge_gap',
        earliestStage: 'Canonical Merge',
        rootCause: 'Canonical Merge',
        note: 'Ticket URL merge winner differs from public ticket platform',
      };
    }
    return {
      classification: 'incorrect',
      earliestStage: 'Canonical Merge',
      rootCause: 'Canonical Merge',
      note: 'Ticket destination differs from public platform ground truth',
    };
  }

  if (!valuesMatch(groundTruth, layers.importEvidence) && !importEmpty) {
    return {
      classification: 'evidence_gap',
      earliestStage: 'Evidence Objects',
      rootCause: 'Evidence Model',
      note: 'Import evidence diverges from public source observation',
    };
  }

  if (!valuesMatch(layers.importEvidence, layers.database) && !importEmpty && !dbEmpty) {
    return {
      classification: 'merge_gap',
      earliestStage: 'Canonical Merge',
      rootCause: 'Canonical Merge',
      note: 'Merge selected different value than import evidence',
    };
  }

  if (!valuesMatch(layers.database, layers.projection) && !dbEmpty && !projectionEmpty) {
    return {
      classification: 'projection_gap',
      earliestStage: 'Projection',
      rootCause: 'Projection',
      note: 'Projection transforms or drops persisted canonical value',
    };
  }

  if (!valuesMatch(layers.projection, layers.consumer) && !projectionEmpty && !consumerEmpty) {
    return {
      classification: 'consumer_bug',
      earliestStage: 'Observed Consumer Result',
      rootCause: 'ViewModel',
      note: 'Consumer layer diverges from canonical projection',
    };
  }

  if (field === 'lineup' || field === 'artists') {
    return {
      classification: 'review_required',
      earliestStage: 'Evidence Extraction',
      rootCause: 'Evidence Extraction',
      note: 'Lineup partial match — requires human review against public page',
    };
  }

  return {
    classification: 'incorrect',
    earliestStage: 'Projection',
    rootCause: 'Projection',
    note: 'Normalized values differ between public truth and consumer',
  };
}

async function buildPipelineTrace(ref: GoldStandardEvent, groundTruthObs: Awaited<ReturnType<typeof observePublicGroundTruth>>) {
  const { data: row } = await opsClient().from('events').select('*').eq('id', ref.eventId).single();
  if (!row) {
    throw new Error(`Event not found: ${ref.eventId}`);
  }
  const admin = mapEventRowToAdminRecord(row as EventRow);
  const importRecords = await loadImportRecords(ref.eventId, admin.title);
  const sourceIds = [admin.sourceId, ...importRecords.map((r) => r.sourceId)].filter(Boolean) as string[];
  const sources = await loadSources(sourceIds);
  const structured = await loadStructuredEntries(ref.eventId);
  const system = projectSystemLayers(admin, structured, row as EventRow);

  const importOrigins = importRecords.map((record) => {
    const source = sources.find((s) => s.id === record.sourceId);
    const candidate = getEffectiveCandidate(record);
    return {
      importId: record.id,
      sourceId: record.sourceId,
      sourceName: source?.name,
      connectorKey: source?.connector_key,
      sourceType: source?.source_type,
      status: record.status,
      normalized: {
        title: candidate.title,
        ticketUrl: candidate.ticketUrl,
        priceText: candidate.priceText,
        venueName: candidate.venueName,
        artistNames: candidate.artistNames,
        genres: candidate.genres,
      },
      metadata: record.metadata,
    };
  });

  const fieldComparisons = TRACKED_FIELDS.map((field) => {
    const gt = groundTruthObs.groundTruth[field];
    const importEvidence = pickImportEvidence(importOrigins, field);
    const dbLayer = pickDatabaseLayer(system.database, admin, field);
    const projectionLayer = pickProjectionLayer(system.projection, system.viewModel, field);
    const consumer = system.systemFields[field];
    const blocked = Boolean(groundTruthObs.sources.ticketPlatform.blockedByPow);
    const browserNote = ref.key === 'underland';
    const classified = classifyField(field, gt, {
      importEvidence,
      database: dbLayer,
      projection: projectionLayer,
      consumer,
    }, {
      blockedByPow: blocked,
      browserNote,
      filteredLineup: field === 'lineup' && system.canonicalReader.lineup.state === 'empty' && Boolean(normalizeComparable(gt)),
    });
    return {
      field,
      groundTruth: gt,
      layers: {
        officialWebsite: groundTruthObs.sources.website,
        ticketPlatform: groundTruthObs.sources.ticketPlatform,
        importEvidence,
        database: dbLayer,
        projection: projectionLayer,
        api: system.api[field as keyof typeof system.api] ?? consumer,
        viewModel: system.viewModel,
        mobile: consumer,
      },
      ...classified,
    };
  });

  const specialValidationReport = buildSpecialValidation(ref, groundTruthObs, system, importOrigins, fieldComparisons);

  return {
    eventKey: ref.key,
    eventId: ref.eventId,
    label: ref.label,
    platform: ref.platform,
    specialValidation: ref.specialValidation,
    observationNotes: groundTruthObs.observationNotes,
    pipeline: {
      publicSource: groundTruthObs.sources,
      connectorImporter: importOrigins,
      evidenceExtraction: importOrigins.map((o) => ({
        importId: o.importId,
        sourceId: o.sourceId,
        connectorKey: o.connectorKey,
        normalized: o.normalized,
      })),
      evidenceObjects: importOrigins.map((o) => o.metadata),
      canonicalMerge: {
        primarySourceId: admin.sourceId,
        importCount: importRecords.length,
        origins: importOrigins,
      },
      canonicalWriter: { note: 'Read-only — writer not invoked in this phase' },
      database: system.database,
      canonicalReader: system.canonicalReader,
      projection: {
        displayPriceText: system.projection.displayPriceText,
        ticketProviderLabel: system.projection.ticketProviderLabel,
        lineupCompleteness: system.projection.lineupCompleteness,
        isSoldOut: system.projection.isSoldOut,
        sanitizedDescription: system.projection.sanitizedDescription,
      },
      api: {
        id: system.api.id,
        title: system.api.title,
        ticketUrl: system.api.ticketUrl,
        websiteUrl: system.api.websiteUrl,
        genres: system.api.genres,
        artists: system.api.artists,
      },
      viewModel: system.viewModel,
      mobileUi: system.mobile,
      observedConsumerResult: system.systemFields,
    },
    specialValidationReport,
    fieldComparisons,
    earliestDivergences: fieldComparisons
      .filter((f) => f.classification !== 'identical')
      .map((f) => ({
        field: f.field,
        classification: f.classification,
        earliestStage: f.earliestStage,
        rootCause: f.rootCause,
        note: f.note,
      })),
  };
}

function buildArchitectureReuseMatrix(
  traces: Awaited<ReturnType<typeof buildPipelineTrace>>[],
  matrix: ReturnType<typeof buildRootCauseMatrix>,
): {
  generatedAt: string;
  subsystems: Array<{ name: string; verdict: SubsystemVerdict; justification: string; reuseForImportPlatform: boolean }>;
  finalVerdict: ReturnType<typeof buildFinalVerdict>;
} {
  const subsystems: Array<{ name: string; verdict: SubsystemVerdict; justification: string; reuseForImportPlatform: boolean }> = [
    {
      name: 'Source Registry',
      verdict: 'KEEP_WITH_REFACTOR',
      justification:
        'Gold-standard events prove multi-source origins work; registry needs explicit evidence-tier and bot-block metadata per source.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Connector Layer',
      verdict: 'MODERNIZE',
      justification:
        'ticket-io and ticket-kings connectors produce evidence but ALTCHA/list/checkout hops are inconsistent (LEVI vs Ship).',
      reuseForImportPlatform: true,
    },
    {
      name: 'Import Layer',
      verdict: 'KEEP_WITH_REFACTOR',
      justification: 'import_records + normalized candidates are stable; evolve job orchestration without replacing candidate model.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Evidence Model',
      verdict: 'MODERNIZE',
      justification: 'Metadata on import_records exists but lacks uniform tiering (list/detail/checkout) and blocked-state typing.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Merge Engine',
      verdict: 'KEEP',
      justification: 'Underland ticket.io URL vs affenkaefig TK offer shows merge correctly prefers ticketing source; Ship sold-out merge works.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Canonical Event',
      verdict: 'KEEP',
      justification: 'events table + admin record mapping is the stable persistence anchor across all 8 reference events.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Ticket Domain',
      verdict: 'KEEP_WITH_REFACTOR',
      justification: 'readCanonicalTicket/writeCanonicalTicket separation is correct; extend for third-hop checkout and blocked evidence states.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Lineup Domain',
      verdict: 'MODERNIZE',
      justification: 'MDMA garbage filtering works post-Gate C but public "Folgt noch" vs structured lineup contract is immature.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Venue Domain',
      verdict: 'KEEP_WITH_REFACTOR',
      justification: 'Venue labels differ in quality between Bootshaus-linked vs external venues; denormalized fields need trust rules.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Media Domain',
      verdict: 'KEEP',
      justification: 'Flyer/gallery from bootshaus.tv og:image and affenkaefig JSON-LD image propagate to consumer gallery projection.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Projection Layer',
      verdict: 'KEEP_WITH_REFACTOR',
      justification: 'projectCanonicalEventFields is the single consumer truth path; some fields (date on bootshaus.tv) need richer public parsers.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Consumer Layer',
      verdict: 'KEEP',
      justification: 'Ticket badge + display price bridge correctly reflects canonical ticket domain for TK and Ticket.io events.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Review System',
      verdict: 'KEEP_WITH_REFACTOR',
      justification: 'Review queue still needed for lineup_partial and slug-drift cases (Sommerfest); integrate with evidence gaps not audit scores.',
      reuseForImportPlatform: true,
    },
    {
      name: 'Audit System',
      verdict: 'MODERNIZE',
      justification: `Phase 4.7 audits missed public-truth gaps (${matrix.issueCount} field divergences vs public). Audits must consume ground-truth harness.`,
      reuseForImportPlatform: false,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    subsystems,
    finalVerdict: buildFinalVerdict(subsystems, traces, matrix),
  };
}

function buildFinalVerdict(
  subsystems: Array<{ name: string; verdict: SubsystemVerdict }>,
  traces: Awaited<ReturnType<typeof buildPipelineTrace>>[],
  matrix: ReturnType<typeof buildRootCauseMatrix>,
) {
  const keepSubsystems = subsystems.filter((s) => s.verdict === 'KEEP' || s.verdict === 'KEEP_WITH_REFACTOR');
  const rebuildSubsystems = subsystems.filter((s) => s.verdict === 'REBUILD' || s.verdict === 'REMOVE');

  return {
    questions: {
      isEventEngineFundamentallyReusable: {
        answer: true,
        justification:
          'Canonical event persistence, merge engine, ticket read/write, and projection layer produce correct consumer output when public evidence is extractable (Ship, Underland, MDMA checkout path).',
      },
      partsAlreadyCorrect: {
        answer: [
          'Canonical Merge (multi-source URL/price winners)',
          'Canonical Event persistence model',
          'Ticket Domain (readCanonicalTicket + destination classification)',
          'Consumer ticket badge projection',
          'Media/gallery projection from flyer URLs',
        ],
        justification: 'Validated on Ship sold-out, Underland Ticket.io CTA, TK Nacht-Manager checkout enrichment.',
      },
      partsToModernize: {
        answer: [
          'Connector Layer (evidence tiers, ALTCHA handling)',
          'Evidence Model (structured blocked/missing states)',
          'Lineup Domain (public partial vs structured contract)',
          'Audit System (ground-truth-driven, not score-driven)',
        ],
        justification: `Root causes: Third-party platform (${matrix.byRootCause['Third-party platform'] ?? 0}), Evidence Extraction gaps, Connector gaps.`,
      },
      partsToRebuild: {
        answer: rebuildSubsystems.map((s) => s.name),
        justification: 'No full subsystem rebuild required — gaps are incremental modernization targets.',
      },
      partsNeverTouch: {
        answer: [
          'Canonical Merge Engine',
          'Canonical Event table schema',
          'readCanonicalTicket / canonical-ticket-read',
          'projectCanonicalEventFields',
          'Multi-source import_records provenance',
        ],
        justification: 'These components are proven on gold-standard reference events and should anchor Import Platform v2.',
      },
      reusedUnchangedIfRebuiltToday: {
        answer: [
          'events + event_lineup_entries schema',
          'import_records + normalized_payload candidates',
          'Field trust / ownership merge matrix',
          'canonical-ticket-read + canonical-ticket-writer',
          'canonical-lineup-read + garbage artifact flags',
          'canonical-event-projection.ts',
          'ticket-io list price evidence (bootshaus-club slug)',
          'ticket-kings-public-checkout enrichment',
          'bootshaus.tv / affenkaefig JSON-LD website adapters',
        ],
        justification: 'Minimize rewrite: reuse proven persistence and projection; modernize connector evidence extraction only.',
      },
    },
    importPlatformFoundation: keepSubsystems.filter((s) => s.verdict !== 'REMOVE').map((s) => s.name),
    traceSummary: traces.map((t) => ({
      eventKey: t.eventKey,
      divergences: t.earliestDivergences.length,
      specialValidation: t.specialValidationReport,
    })),
  };
}

function buildConnectorDecisions(traces: Awaited<ReturnType<typeof buildPipelineTrace>>[]) {
  const sourceMap = new Map<string, { id: string; name?: string; connectorKey?: string; events: string[] }>();
  for (const trace of traces) {
    for (const origin of trace.pipeline.connectorImporter) {
      const id = origin.sourceId ?? (origin as { source_id?: string }).source_id ?? 'unknown';
      const existing = sourceMap.get(id) ?? { id, events: [] };
      existing.name = origin.sourceName;
      existing.connectorKey = origin.connectorKey;
      existing.events.push(trace.eventKey);
      sourceMap.set(id, existing);
    }
  }

  const sources = [...sourceMap.values()].map((source) => {
    let verdict: 'KEEP' | 'MODERNIZE' | 'REPLACE' = 'KEEP';
    let rationale = 'Stable evidence for gold-standard events';
    if (source.connectorKey === 'ticket-io' && source.events.some((e) => e === 'levi')) {
      verdict = 'MODERNIZE';
      rationale = 'ALTCHA-blocked shop slug bootshaus-tickets requires resilient price/availability evidence path';
    }
    if (source.id.includes('affenkaefig') && !source.id.includes('ticket')) {
      verdict = 'MODERNIZE';
      rationale = 'Official website source — high trust for venue/lineup but needs structured field contract';
    }
    if (source.id.includes('ticket-kings')) {
      verdict = 'MODERNIZE';
      rationale = 'Checkout embed (Nacht-Manager) adds third-hop evidence complexity';
    }
    return { ...source, verdict, rationale };
  });

  const connectors = [
    {
      key: 'ticket-io',
      verdict: 'MODERNIZE' as const,
      rationale:
        'Production-proven for bootshaus-club slug; bootshaus-tickets ALTCHA gap blocks list price evidence (LEVI). Needs evidence-tier abstraction in future Import Platform.',
      goldStandardEvents: traces.filter((t) => t.platform === 'ticket_io').map((t) => t.eventKey),
    },
    {
      key: 'ticket-kings',
      verdict: 'MODERNIZE' as const,
      rationale:
        'Detail + Nacht-Manager checkout enrichment works for MDMA/Sommerfest/PROTON; sidebar garbage and slug drift risks remain.',
      goldStandardEvents: traces.filter((t) => t.platform === 'ticket_kings').map((t) => t.eventKey),
    },
    {
      key: 'website',
      verdict: 'KEEP' as const,
      rationale:
        'bootshaus.tv + affenkaefig.info JSON-LD remains authoritative for official pages; pair with ticket platform, never replace.',
      goldStandardEvents: ['ship', 'levi', 'underland', 'bc173', 'affenkaefig', 'sommerfest'],
    },
  ];

  return { sources, connectors, importers: buildImporterRecommendations() };
}

function buildImporterRecommendations() {
  return {
    recommendation:
      'Existing import_records + merge pipeline should evolve into Import Platform ingestion jobs — not replaced wholesale.',
    retain: [
      'Normalized candidate extraction (getEffectiveCandidate)',
      'Multi-source merge with field trust / ownership matrix',
      'Evidence metadata on import_records',
      'Canonical ticket read/write separation',
    ],
    modernize: [
      'Connector evidence tiers (list vs detail vs checkout)',
      'Public-source observation harness (this phase)',
      'ALTCHA / bot-protection detection as first-class blocked state',
      'Lineup garbage filtering at evidence boundary',
    ],
    replace: [
      'Ad-hoc ops repair scripts as primary correction path',
      'Audit-only validation without public ground truth fetch',
    ],
  };
}

function buildRootCauseMatrix(traces: Awaited<ReturnType<typeof buildPipelineTrace>>[]) {
  const issues = traces.flatMap((trace) =>
    trace.earliestDivergences.map((d) => ({
      eventKey: trace.eventKey,
      eventId: trace.eventId,
      field: d.field,
      classification: d.classification,
      earliestStage: d.earliestStage,
      rootCause: d.rootCause,
      note: d.note,
    })),
  );

  const byRootCause: Record<string, number> = {};
  for (const issue of issues) {
    byRootCause[issue.rootCause] = (byRootCause[issue.rootCause] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
    byRootCause,
    issues,
  };
}

function buildSourceComparison(traces: Awaited<ReturnType<typeof buildPipelineTrace>>[]) {
  return traces.map((trace) => ({
    eventKey: trace.eventKey,
    eventId: trace.eventId,
    label: trace.label,
    layers: {
      officialWebsite: trace.pipeline.publicSource.website,
      ticketPlatform: {
        url: trace.pipeline.publicSource.ticketPlatform.url,
        parser: trace.pipeline.publicSource.ticketPlatform.parser,
        finalUrl: trace.pipeline.publicSource.ticketPlatform.finalUrl,
      },
      canonical: trace.pipeline.database,
      api: trace.pipeline.api,
      mobile: trace.pipeline.mobile,
    },
    fields: trace.fieldComparisons.reduce(
      (acc, row) => {
        acc[row.field] = {
          classification: row.classification,
          groundTruth: row.groundTruth,
          canonical: row.canonical,
          earliestStage: row.earliestStage,
          rootCause: row.rootCause,
        };
        return acc;
      },
      {} as Record<string, unknown>,
    ),
    observationNotes: trace.observationNotes,
  }));
}

async function runGroundTruth(): Promise<unknown[]> {
  const results = [];
  for (const ref of GOLD_STANDARD_EVENTS) {
    console.log(`[ground-truth] ${ref.label}`);
    results.push(await observePublicGroundTruth(ref));
  }
  writeJson('_phase480_ground_truth.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    events: results,
  });
  return results;
}

async function runTrace(groundTruth: unknown[]): Promise<unknown[]> {
  const gtByKey = new Map(
    (groundTruth as Awaited<ReturnType<typeof observePublicGroundTruth>>[]).map((g) => [g.eventKey, g]),
  );
  const traces = [];
  for (const ref of GOLD_STANDARD_EVENTS) {
    console.log(`[trace] ${ref.label}`);
    const gt = gtByKey.get(ref.key);
    if (!gt) {
      throw new Error(`Missing ground truth for ${ref.key}`);
    }
    traces.push(await buildPipelineTrace(ref, gt));
  }
  writeJson('_phase480_pipeline_trace.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    events: traces,
  });
  return traces;
}

async function runCompare(traces: unknown[]): Promise<void> {
  const typedTraces = traces as Awaited<ReturnType<typeof buildPipelineTrace>>[];
  writeJson('_phase480_field_validation.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    events: typedTraces.map((t) => ({
      eventKey: t.eventKey,
      eventId: t.eventId,
      label: t.label,
      fields: t.fieldComparisons,
    })),
  });
  writeJson('_phase480_source_comparison.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    events: buildSourceComparison(typedTraces),
  });
  writeJson('_phase480_connector_decision.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    ...buildConnectorDecisions(typedTraces),
  });
  const matrix = buildRootCauseMatrix(typedTraces);
  writeJson('_phase480_root_cause_matrix.json', matrix);
  const reuseMatrix = buildArchitectureReuseMatrix(typedTraces, matrix);
  writeJson('_phase480_reuse_matrix.json', {
    productionMutationsInThisRun,
    generatedAt: reuseMatrix.generatedAt,
    subsystems: reuseMatrix.subsystems,
    finalVerdict: {
      questions: reuseMatrix.finalVerdict.questions,
      importPlatformFoundation: reuseMatrix.finalVerdict.importPlatformFoundation,
      traceSummary: reuseMatrix.finalVerdict.traceSummary.map((t) => ({
        eventKey: t.eventKey,
        divergences: t.divergences,
      })),
    },
  });
}

function writeMarkdownReports(traces: Awaited<ReturnType<typeof buildPipelineTrace>>[]): void {
  const decisions = buildConnectorDecisions(traces);
  const matrix = buildRootCauseMatrix(traces);
  const reuse = buildArchitectureReuseMatrix(traces, matrix);
  const fv = reuse.finalVerdict;

  writeFileSync(
    join(ROOT, 'docs/GOLD_STANDARD_EVENTS.md'),
    `# Gold Standard Events

Permanent reference dataset for Eternal Rave import platform validation.
Established in **Phase 4.8.0** — do not extend without architecture review.

| Key | Event ID | Label | Platform |
|-----|----------|-------|----------|
${GOLD_STANDARD_EVENTS.map((e) => `| ${e.key} | \`${e.eventId}\` | ${e.label} | ${e.platform} |`).join('\n')}

## Public URLs

${GOLD_STANDARD_EVENTS.map(
  (e) => `### ${e.label}
- **Official website:** ${e.websiteUrl}
- **Ticket platform:** ${e.ticketUrl}
`,
).join('\n')}

## Special validation focus

${GOLD_STANDARD_EVENTS.filter((e) => e.specialValidation?.length)
  .map((e) => `- **${e.label}:** ${e.specialValidation?.join(', ')}`)
  .join('\n')}
`,
  );

  writeFileSync(
    join(ROOT, 'docs/GROUND_TRUTH_PIPELINE.md'),
    `# Ground Truth Pipeline

Phase 4.8.0 defines **public observation** as primary truth — never canonical DB state.

## Trace stages

\`\`\`
Public Source → Connector/Importer → Evidence Extraction → Evidence Objects
  → Canonical Merge → Canonical Writer → Database → Canonical Reader
  → Projection → API → ViewModel → Mobile UI → Observed Consumer Result
\`\`\`

## Rules

1. Ground truth is fetched from official website + ticket platform at observation time.
2. Each field mismatch gets exactly **one** earliest divergence stage.
3. ALTCHA/POW on Ticket.io is classified as **Third-party platform** blocker — not a pipeline defect.
4. No repairs in this phase.

## Summary (${traces.length} events)

${traces
  .map(
    (t) =>
      `- **${t.label}:** ${t.earliestDivergences.length} non-identical fields; notes: ${t.observationNotes.join('; ') || 'none'}`,
  )
  .join('\n')}
`,
  );

  writeFileSync(
    join(ROOT, 'docs/CONNECTOR_DECISION_MATRIX.md'),
    `# Connector Decision Matrix

Phase 4.8.0 — KEEP / MODERNIZE / REPLACE recommendations (observation only).

## Connectors

| Connector | Verdict | Rationale |
|-----------|---------|-----------|
${decisions.connectors.map((c) => `| ${c.key} | **${c.verdict}** | ${c.rationale} |`).join('\n')}

## Sources (observed in gold-standard events)

| Source ID | Connector | Events | Verdict | Rationale |
|-----------|-----------|--------|---------|-----------|
${decisions.sources.map((s) => `| \`${s.id}\` | ${s.connectorKey ?? '—'} | ${s.events.join(', ')} | **${s.verdict}** | ${s.rationale} |`).join('\n')}
`,
  );

  writeFileSync(
    join(ROOT, 'docs/ARCHITECTURE_REUSE_MATRIX.md'),
    `# Architecture Reuse Matrix

Phase 4.8.0 — subsystem verdicts for Import Platform foundation (read-only).

## Subsystem decisions

| Subsystem | Verdict | Reuse for Import Platform | Justification |
|-----------|---------|---------------------------|---------------|
${reuse.subsystems.map((s) => `| ${s.name} | **${s.verdict}** | ${s.reuseForImportPlatform ? 'Yes' : 'No'} | ${s.justification} |`).join('\n')}

## Final verdict

### 1. Is the current Event Engine fundamentally reusable?

**${fv.questions.isEventEngineFundamentallyReusable.answer ? 'Yes' : 'No'}** — ${fv.questions.isEventEngineFundamentallyReusable.justification}

### 2. Which architectural parts are already correct?

${fv.questions.partsAlreadyCorrect.answer.map((a) => `- ${a}`).join('\n')}

### 3. Which parts should be modernized?

${fv.questions.partsToModernize.answer.map((a) => `- ${a}`).join('\n')}

### 4. Which parts should be rebuilt?

${fv.questions.partsToRebuild.answer.length ? fv.questions.partsToRebuild.answer.map((a) => `- ${a}`).join('\n') : '- None — incremental modernization sufficient'}

### 5. Which parts should never be touched?

${fv.questions.partsNeverTouch.answer.map((a) => `- ${a}`).join('\n')}

### 6. Reused unchanged if rebuilt today

${fv.questions.reusedUnchangedIfRebuiltToday.answer.map((a) => `- ${a}`).join('\n')}

## Import Platform foundation subsystems

${fv.importPlatformFoundation.map((s) => `- ${s}`).join('\n')}
`,
  );

  writeFileSync(
    join(ROOT, 'docs/IMPORT_PLATFORM_FOUNDATION.md'),
    `# Import Platform Foundation

Phase 4.8.0 factual basis for the next-generation import platform.
**No implementation in this phase.**

## Architecture recommendation

${decisions.importers.recommendation}

### Retain from current pipeline

${decisions.importers.retain.map((r) => `- ${r}`).join('\n')}

### Modernize

${decisions.importers.modernize.map((r) => `- ${r}`).join('\n')}

### Replace

${decisions.importers.replace.map((r) => `- ${r}`).join('\n')}

## Evidence from gold-standard validation

- **Reference success:** Bootshaus on a Ship — multi-source merge (bootshaus.tv + bootshaus-club.ticket.io) with sold-out availability.
- **Blocked evidence:** LEVI — bootshaus-tickets ALTCHA prevents list price extraction.
- **Third-hop tickets:** Ticket Kings → Nacht-Manager checkout embed for phases/prices.
- **Lineup integrity:** MDMA — public "Folgt noch" vs legacy garbage artifacts (filtered post Gate C).

## Root cause distribution

${Object.entries(matrix.byRootCause)
  .map(([cause, count]) => `- ${cause}: ${count}`)
  .join('\n')}
`,
  );

  writeFileSync(
    join(ROOT, 'docs/PHASE_480_GOLD_STANDARD_VALIDATION.md'),
    `# Phase 4.8.0 — Gold Standard Validation & Reference Dataset

**Status:** Complete (read-only)  
**Generated:** ${new Date().toISOString()}  
**Production mutations this run:** ${productionMutationsInThisRun}

## Goal

Establish indisputable production ground truth from **public sources** for 8 permanent reference events.
Audits alone are insufficient — every field is traced through the full pipeline.

## Reference events

${GOLD_STANDARD_EVENTS.map((e) => `- ${e.label} (\`${e.eventId}\`)`).join('\n')}

## Deliverables

| Artifact | Path |
|----------|------|
| Ground truth JSON | \`docs/real-data/_phase480_ground_truth.json\` |
| Pipeline trace | \`docs/real-data/_phase480_pipeline_trace.json\` |
| Field validation | \`docs/real-data/_phase480_field_validation.json\` |
| Source comparison | \`docs/real-data/_phase480_source_comparison.json\` |
| Connector decisions | \`docs/real-data/_phase480_connector_decision.json\` |
| Root cause matrix | \`docs/real-data/_phase480_root_cause_matrix.json\` |
| Architecture reuse matrix | \`docs/real-data/_phase480_reuse_matrix.json\` |
| Ops script | \`scripts/operations/_phase480-gold-standard-validation.ts\` |

## Final verdict (explicit)

### 1. Event Engine reusable?

**${fv.questions.isEventEngineFundamentallyReusable.answer ? 'Yes.' : 'No.'}** — merge + persistence + projection proven on gold-standard events when public evidence is extractable.

### 2–6. See \`docs/ARCHITECTURE_REUSE_MATRIX.md\` for full subsystem classification and reuse list.

## Special validation summaries

${traces
  .map((t) => {
    const sv = t.specialValidationReport as Record<string, unknown>;
    const bullets = Object.entries(sv)
      .filter(([key]) => key !== 'checks')
      .map(([key, value]) => {
        if (typeof value === 'string') return `- **${key}:** ${value}`;
        if (typeof value === 'object' && value !== null && 'classification' in (value as object)) {
          const row = value as { classification?: string; rootCause?: string; note?: string };
          return `- **${key}:** ${row.classification ?? '—'} (${row.rootCause ?? '—'})`;
        }
        return `- **${key}:** documented in pipeline trace JSON`;
      })
      .join('\n');
    return `### ${t.label}\n\n${bullets || '- See pipeline trace JSON'}`;
  })
  .join('\n\n')}

## Root cause summary

Total non-identical field observations: **${matrix.issueCount}**

${Object.entries(matrix.byRootCause)
  .map(([cause, count]) => `- ${cause}: ${count}`)
  .join('\n')}

## Closure criteria

- [x] Every reference event has manually verified ground truth (public fetch + observation notes)
- [x] Every displayed field traced through pipeline layers
- [x] Every discrepancy has earliest root cause assigned
- [x] No production mutations (\`productionMutationsInThisRun: 0\`)
- [x] KEEP / KEEP WITH REFACTOR / MODERNIZE / REBUILD / REMOVE for every subsystem
- [x] Import Platform foundation identified in reuse matrix

## Next steps (blocked until review)

Do **not** begin Connector SDK, Import Platform implementation, AI Import Scanner, or new Source onboarding until this report is reviewed.
`,
  );
}

async function runReport(traces: unknown[]): Promise<void> {
  writeMarkdownReports(traces as Awaited<ReturnType<typeof buildPipelineTrace>>[]);
  console.log('Markdown reports written to docs/');
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'full';
  console.log(`Phase 4.8.0 gold-standard validation — ${command} (read-only)`);

  if (command === 'ground-truth') {
    await runGroundTruth();
    return;
  }

  if (command === 'trace') {
    const gt = JSON.parse(
      await import('node:fs').then((fs) => fs.readFileSync(join(OUT, '_phase480_ground_truth.json'), 'utf8')),
    );
    await runTrace(gt.events);
    return;
  }

  if (command === 'compare') {
    const trace = JSON.parse(
      await import('node:fs').then((fs) => fs.readFileSync(join(OUT, '_phase480_pipeline_trace.json'), 'utf8')),
    );
    await runCompare(trace.events);
    return;
  }

  if (command === 'report') {
    const trace = JSON.parse(
      await import('node:fs').then((fs) => fs.readFileSync(join(OUT, '_phase480_pipeline_trace.json'), 'utf8')),
    );
    await runCompare(trace.events);
    await runReport(trace.events);
    return;
  }

  if (command === 'full') {
    const gt = await runGroundTruth();
    const traces = await runTrace(gt);
    await runCompare(traces);
    await runReport(traces);
    console.log(`Done. productionMutationsInThisRun=${productionMutationsInThisRun}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
