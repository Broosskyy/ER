/**
 * Phase 4.7.7 — Root-cause production repair (gated, approval-required mutations).
 *
 * Usage:
 *   npx tsx scripts/operations/_phase477-root-cause-production-repair.ts <command>
 *
 * Commands:
 *   audit | full-audit
 *   preview-staging | preview-ticket-destinations | preview-ticketio | preview-mdma-artists
 *   preview-projections | preview-venues
 *   backup-gate --gate=0|A|B|C|D|E
 *   repair-staging | repair-ticket-destinations | repair-ticketio | repair-mdma-artists
 *   repair-projections | repair-venues
 *   audit-after | report
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { isTicketIoShopRootUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import {
  discoverTicketIoPriceEvidence,
  classifyTicketIoPriceFailure,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { extractTicketIoEventSlugFromUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-enrichment';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { readCanonicalLineup } from '@/features/events/domain/canonical-lineup-read';
import { evaluateArtistCandidate } from '@/features/events/domain/artist-candidate-quality-gate';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { mapCanonicalAvailabilityToTicketBadge } from '@/features/events/formatting/ticket-badge-projection';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { isInternalEntityId } from '@/features/events/discovery/internal-event-eligibility';
import { markInvalidLineupArtifacts } from '@/features/import/services/p0-invalid-artist-cleanup';
import { opsClient } from './ops-supabase-rows';

async function invalidateCaches(): Promise<void> {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  await invalidateConsumerEventCaches(registry.eventRepository);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const REPORT = join(ROOT, 'docs/PHASE_477_ROOT_CAUSE_PRODUCTION_REPAIR.md');

const PALMA_SHOP_ROOT_IDS = [
  'evt-1785339424521-tn10siz',
  'evt-1785339413919-ix5umo9',
  'evt-1785339377456-7miaf2o',
  'evt-1785339409363-puvo8be',
  'evt-1785339388133-sq2ykbm',
  'evt-1785339407876-uqm3mz0',
] as const;

const MDMA_1010_ID = 'evt-1785443911160-owt97y3';
const UNDERLAND_ID = 'evt-1785389049895-4mb7dub';
const LEVI_ID = 'evt-1785339383539-0lxvjlp';

const TICKET_DEST_CODES = new Set([
  'shop_root_cta',
  'shop_root_purchase_url',
  'wrong_ticket_destination',
  'generic_provider_homepage',
  'stale_event_url',
  'required_parameters_lost',
]);

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

type GateId = '0' | 'A' | 'B' | 'C' | 'D' | 'E';

type RepairabilityItem = {
  eventId: string;
  title: string;
  code: string;
};

type RepairRun = {
  gate: GateId;
  command: string;
  pass: number;
  generatedAt: string;
  mutations: number;
  events: unknown[];
};

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

function loadRepairability(): RepairabilityItem[] {
  const path = join(OUT, '_phase4751_repairability.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    byClass: { repairable_now: RepairabilityItem[] };
  };
  return parsed.byClass.repairable_now ?? [];
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data, error } = await opsClient().from('events').select('*').eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

function isStagingFixture(event: AdminEventRecord): boolean {
  return (
    isInternalEntityId(event.id) ||
    event.id === 'klangkuenstler-berghain' ||
    (event.sourceId?.includes('staging-seed') ?? false)
  );
}

async function loadEventById(eventId: string): Promise<AdminEventRecord | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapEventRowToAdminRecord(data as EventRow) : null;
}

function eventForbiddenFingerprint(event: AdminEventRecord) {
  return {
    title: event.title,
    ticketUrl: event.ticketUrl ?? '',
    websiteUrl: event.websiteUrl ?? '',
    priceText: event.priceText ?? '',
    ticketStatus: event.ticketStatus ?? '',
    venueId: event.venueId ?? '',
    venueName: event.venueName ?? '',
    imageUrl: event.imageUrl ?? '',
    sourceId: event.sourceId ?? '',
    descriptionHash: hashValue(event.description),
  };
}

function loadStagingPreviewIds(): Set<string> {
  const preview = JSON.parse(readFileSync(join(OUT, '_phase477_staging_cleanup_preview.json'), 'utf8')) as {
    items: Array<{ eventId: string; sourceId?: string }>;
  };
  return new Set(preview.items.map((item) => item.eventId));
}

function isApprovedStagingFixture(event: AdminEventRecord, previewIds: Set<string>): boolean {
  if (!previewIds.has(event.id)) {
    return false;
  }
  return (
    event.sourceId === 'staging-seed-source-manual' ||
    event.id === 'klangkuenstler-berghain' ||
    isInternalEntityId(event.id)
  );
}

async function artistLinkedEventIds(artistId: string, excludeEventId: string): Promise<string[]> {
  const client = opsClient();
  const [{ data: legacy }, { data: structured }] = await Promise.all([
    client.from('event_artists').select('event_id').eq('artist_id', artistId),
    client.from('event_lineup_entry_artists').select('event_lineup_entries!inner(event_id)').eq('artist_id', artistId),
  ]);
  const ids = new Set<string>();
  for (const row of legacy ?? []) {
    if (row.event_id !== excludeEventId) {
      ids.add(row.event_id);
    }
  }
  for (const row of structured ?? []) {
    const eventId = (row.event_lineup_entries as { event_id?: string } | null)?.event_id;
    if (eventId && eventId !== excludeEventId) {
      ids.add(eventId);
    }
  }
  return [...ids];
}

async function countRelationships(eventId: string) {
  const client = opsClient();
  const [tickets, lineup, saved, artists] = await Promise.all([
    client.from('event_ticket_phases').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_lineup_entries').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('saved_events').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_artists').select('artist_id', { count: 'exact', head: true }).eq('event_id', eventId),
  ]);
  return {
    ticketPhases: tickets.count ?? 0,
    lineupEntries: lineup.count ?? 0,
    saved: saved.count ?? 0,
    legacyArtists: artists.count ?? 0,
  };
}

function projectConsumer(event: AdminEventRecord) {
  const canonicalTicket = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  const canonical = projectCanonicalEventFields({
    title: event.title,
    description: event.description ?? '',
    venue: event.venueName ?? '',
    city: event.venueCity ?? '',
    artists: [],
    priceText: canonicalTicket.priceText ?? event.priceText,
    source: event.sourceId ?? 'supabase',
    ticketUrl: canonicalTicket.publicCtaUrl ?? event.ticketUrl,
    ticketPlatform: canonicalTicket.ticketPlatform,
    ticketDestinationClass: canonicalTicket.destinationClass,
    ticketStatus: canonicalTicket.ticketStatus ?? event.ticketStatus,
    ticketPhases: event.ticketPhases?.map((phase) => ({
      soldOut: phase.soldOut,
      available: phase.available,
      label: phase.name,
    })),
    imageUrl: event.imageUrl,
  });
  const ticketBadge = mapCanonicalAvailabilityToTicketBadge(
    canonicalTicket.availability,
    canonicalTicket.ticketStatus,
  );
  return { canonicalTicket, canonical, ticketBadge };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function traceUnderlandDestination(event: AdminEventRecord) {
  const ticketUrl = event.ticketUrl ?? '';
  const redirectChain: Array<{ url: string; status: number }> = [];
  let current = ticketUrl;
  for (let i = 0; i < 5 && current; i++) {
    const response = await fetch(current, { headers: FETCH_HEADERS, redirect: 'manual' });
    redirectChain.push({ url: current, status: response.status });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).href;
      continue;
    }
    break;
  }
  const { canonicalTicket, canonical } = projectConsumer(event);
  const destination = classifyTicketDestination(event.ticketUrl ?? event.websiteUrl);
  return {
    eventId: event.id,
    dbTicketUrl: event.ticketUrl,
    dbPriceText: event.priceText,
    projectedTicketUrl: canonical.ticketUrl,
    projectedDisplayPrice: canonical.displayPriceText,
    destinationClass: destination.destinationClass,
    isShopRoot: isTicketIoShopRootUrl(event.ticketUrl ?? ''),
    eventSlug: extractTicketIoEventSlugFromUrl(event.ticketUrl ?? ''),
    redirectChain,
    firstDivergence:
      canonical.ticketUrl === event.ticketUrl
        ? redirectChain.length > 1
          ? 'redirect_or_cache'
          : 'none_observed'
        : 'projection',
  };
}

async function previewStaging(events: AdminEventRecord[]) {
  const fixtures = events.filter(isStagingFixture);
  const items = [];
  for (const event of fixtures) {
    const rel = await countRelationships(event.id);
    items.push({
      eventId: event.id,
      title: event.title,
      sourceId: event.sourceId,
      provenance: 'staging-seed SQL fixture / demo regression data',
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      relationships: rel,
      classificationReason:
        event.id.startsWith('staging-seed') || event.id === 'klangkuenstler-berghain'
          ? 'ID prefix matches validate-staging-seed.ts required fixtures'
          : 'Internal entity id or staging source marker',
      proposedAction: 'status: published → archived (preserve rows, unlink from consumer discovery)',
    });
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    gate: '0',
    count: items.length,
    items,
  };
  writeJson('_phase477_staging_cleanup_preview.json', payload);
  return payload;
}

async function previewTicketDestinations(events: AdminEventRecord[]) {
  const palma = events.filter((e) => PALMA_SHOP_ROOT_IDS.includes(e.id as (typeof PALMA_SHOP_ROOT_IDS)[number]));
  const underland = events.find((e) => e.id === UNDERLAND_ID);
  const mutations = [];
  for (const event of palma) {
    const dest = classifyTicketDestination(event.ticketUrl ?? event.websiteUrl);
    mutations.push({
      eventId: event.id,
      title: event.title,
      currentTicketUrl: event.ticketUrl,
      currentWebsiteUrl: event.websiteUrl,
      destinationClass: dest.destinationClass,
      proposedTicketUrl: null,
      proposedWebsiteUrl: event.websiteUrl ?? event.ticketUrl,
      strategy: 'official_page_only — clear shop-root ticket_url; retain Bootshaus official page as consumer CTA',
      blocked: false,
      note: 'Do not invent Ticket.io event slug; Fourvenues handling deferred to supported-platform phase',
    });
  }
  const underlandTrace = underland ? await traceUnderlandDestination(underland) : null;
  const payload = {
    generatedAt: new Date().toISOString(),
    gate: 'A',
    palmaMutations: mutations,
    underlandTrace,
    underlandRepairRequired: false,
    underlandNote:
      underlandTrace?.firstDivergence === 'none_observed'
        ? 'DB and projection already event-specific; user-visible generic page is redirect/cache — Gate D cache invalidation only'
        : 'Investigate projection divergence',
  };
  writeJson('_phase477_ticket_destination_preview.json', payload);
  return payload;
}

async function previewTicketIo(events: AdminEventRecord[]) {
  const targets = events.filter((e) => {
    const url = e.ticketUrl ?? '';
    return /ticket\.io/i.test(url) && !isTicketIoShopRootUrl(url);
  });
  const cohortLabels = [/levi/i, /blacklist/i, /technodampfer/i, /affenkäfig|affenkaefig/i];
  const results = [];
  for (const event of targets) {
    const url = event.ticketUrl ?? '';
    const shopMatch = url.match(/https?:\/\/([^.]+)\.ticket\.io/i);
    const shopSlug = shopMatch?.[1] ?? '';
    const listUrl = shopSlug ? `https://${shopSlug}.ticket.io/` : '';
    let discovery = null;
    let failure = null;
    if (shopSlug && listUrl) {
      try {
        const listHtml = await fetchHtml(listUrl);
        let detailHtml: string | undefined;
        try {
          detailHtml = await fetchHtml(url);
        } catch {
          detailHtml = undefined;
        }
        discovery = discoverTicketIoPriceEvidence({ shopSlug, listUrl, listHtml, eventUrl: url, detailHtml });
        failure = classifyTicketIoPriceFailure({
          hasEventSlug: Boolean(extractTicketIoEventSlugFromUrl(url)),
          isShopRootUrl: false,
          discovery,
          dbPriceText: event.priceText ?? '',
        });
      } catch (error) {
        failure = { failure: 'FETCH_ERROR', message: String(error) };
      }
    }
    const isCohort = cohortLabels.some((p) => p.test(event.title));
    const missingPrice = !event.priceText?.trim();
    if (!isCohort && !missingPrice) {
      continue;
    }
    if (!missingPrice) {
      continue;
    }
    results.push({
      eventId: event.id,
      title: event.title,
      ticketUrl: url,
      shopSlug,
      dbPriceText: event.priceText,
      dbTicketStatus: event.ticketStatus,
      discovery: discovery
        ? {
            bestHit: discovery.bestHit,
            hitCount: discovery.hits.length,
            listRowCount: discovery.listRowCount,
            detailAltchaBlocked: discovery.detailAltchaBlocked,
          }
        : null,
      failure,
      repairable: Boolean(discovery?.bestHit?.priceText),
      proposedMutation: discovery?.bestHit?.priceText
        ? { priceText: discovery.bestHit.priceText, ticketStatus: discovery.bestHit.availability }
        : null,
      blocker: discovery?.bestHit?.priceText ? null : failure,
    });
  }
  const levi = results.find((r) => r.eventId === LEVI_ID);
  const payload = {
    generatedAt: new Date().toISOString(),
    gate: 'B',
    auditedHosts: [...new Set(results.map((r) => r.shopSlug).filter(Boolean))],
    results,
    leviRequired: {
      eventId: LEVI_ID,
      url: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
      result: levi,
      firstFailingStage: levi?.blocker?.failure ?? (levi?.repairable ? null : 'unknown'),
    },
  };
  writeJson('_phase477_ticketio_connector_preview.json', payload);
  return payload;
}

async function snapshotMdmaLineup(eventId: string) {
  const client = opsClient();
  const { data: entries } = await client
    .from('event_lineup_entries')
    .select('id, billing_relation, event_lineup_entry_artists(artist_id, artists(name, lineup_legacy_artifact))')
    .eq('event_id', eventId);
  const { data: legacy } = await client
    .from('event_artists')
    .select('artist_id, artists(name, lineup_legacy_artifact)')
    .eq('event_id', eventId);
  return { structuredEntries: entries ?? [], legacyArtists: legacy ?? [] };
}

async function previewMdmaArtists(events: AdminEventRecord[]) {
  const mdma = events.find((e) => e.id === MDMA_1010_ID);
  const gateCItems = loadRepairability().filter(
    (i) => i.code.includes('lineup') || i.eventId === MDMA_1010_ID,
  );
  const artistReviewIds = [
    'evt-1785339395746-in3ijod',
    'evt-1785339409363-puvo8be',
  ];
  const snapshots = [];
  for (const eventId of [MDMA_1010_ID, ...artistReviewIds]) {
    const event = events.find((e) => e.id === eventId);
    const lineup = await snapshotMdmaLineup(eventId);
    const garbageArtists: string[] = [];
    for (const entry of lineup.structuredEntries as Array<{
      event_lineup_entry_artists?: Array<{ artists?: { name?: string } | null }>;
    }>) {
      for (const link of entry.event_lineup_entry_artists ?? []) {
        const name = link.artists?.name ?? '';
        if (name && !evaluateArtistCandidate({ name, sourceField: 'lineup' }).accepted) {
          garbageArtists.push(name);
        }
      }
    }
    const canonical = event
      ? readCanonicalLineup({ structuredEntries: toResolvedFromSnapshot(lineup), eventTitle: event.title })
      : null;
    snapshots.push({
      eventId,
      title: event?.title,
      garbageArtists,
      structuredCount: lineup.structuredEntries.length,
      legacyCount: lineup.legacyArtists.length,
      displayedArtistCount: canonical?.artistNames.length ?? 0,
      tkEvidence: eventId === MDMA_1010_ID ? 'Line Up: Folgt noch (Ticket Kings source)' : undefined,
      proposedAction:
        eventId === MDMA_1010_ID
          ? 'Clear structured lineup (empty evidence); mark garbage artists legacy; upstream TK parser excludes tribe-related-events sidebar'
          : garbageArtists.length > 0
            ? 'Review artist identity — no unsafe merge'
            : 'No mutation',
    });
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    gate: 'C',
    repairabilityItems: gateCItems,
    snapshots,
    mdma1010: snapshots.find((s) => s.eventId === MDMA_1010_ID),
  };
  writeJson('_phase477_mdma_artist_repair_preview.json', payload);
  return payload;
}

function toResolvedFromSnapshot(lineup: Awaited<ReturnType<typeof snapshotMdmaLineup>>) {
  return lineup.structuredEntries.map((entry, index) => {
    const row = entry as {
      id: string;
      billing_relation?: string;
      event_lineup_entry_artists?: Array<{ artists?: { name?: string } | null }>;
    };
    return {
      order: index,
      entryId: row.id,
      billingRelation: (row.billing_relation ?? 'SOLO') as 'SOLO',
      artists: (row.event_lineup_entry_artists ?? [])
        .map((l) => l.artists?.name)
        .filter((n): n is string => Boolean(n)),
      artistIds: [],
    };
  });
}

async function previewProjections(events: AdminEventRecord[]) {
  const repairs = [];
  for (const event of events) {
    if (isStagingFixture(event)) {
      continue;
    }
    const { canonicalTicket, canonical, ticketBadge } = projectConsumer(event);
    const issues: string[] = [];
    if (canonicalTicket.priceText && !canonical.displayPriceText?.includes('€')) {
      issues.push('price_display_mismatch');
    }
    if (canonicalTicket.ticketStatus && !ticketBadge) {
      issues.push('ticket_badge_not_projected');
    }
    if (issues.length === 0) {
      continue;
    }
    repairs.push({
      eventId: event.id,
      title: event.title,
      issues,
      canonicalPrice: canonicalTicket.priceText,
      projectedPrice: canonical.displayPriceText,
      canonicalStatus: canonicalTicket.ticketStatus,
      projectedBadge: ticketBadge,
      firstBrokenStage: 'Projection',
      proposedAction: 'cache invalidation + verify canonical-event-projection parity',
    });
  }
  const underland = events.find((e) => e.id === UNDERLAND_ID);
  if (underland) {
    repairs.push({
      eventId: UNDERLAND_ID,
      title: underland.title,
      issues: ['cache_freshness'],
      note: 'Event-specific ticket URL in DB; invalidate consumer cache if stale bundle served generic destination',
      proposedAction: 'invalidateConsumerEventCaches only',
    });
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    gate: 'D',
    count: repairs.length,
    repairs,
    excludedIncompleteProjection:
      'incomplete_projection from 4.7.5.1 excluded when canonical venue/title absent — not projection bugs',
  };
  writeJson('_phase477_projection_repair_preview.json', payload);
  return payload;
}

async function previewVenues(events: AdminEventRecord[]) {
  const repairs = [];
  for (const event of events) {
    if (isStagingFixture(event)) {
      continue;
    }
    const { data: venue } = event.venueId
      ? await opsClient().from('venues').select('*').eq('id', event.venueId).maybeSingle()
      : { data: null };
    if (!event.venueName && event.venueCity && venue?.name) {
      repairs.push({
        eventId: event.id,
        title: event.title,
        issue: 'venue_name_empty_but_venue_row_exists',
        venueRowName: venue.name,
        proposedVenueName: venue.name,
        blocked: /mallorca/i.test(event.title),
        blocker: /mallorca/i.test(event.title) ? 'ambiguous_mallorca_venue_requires_review' : null,
      });
    }
    if (venue && !event.latitude && venue.latitude && venue.longitude) {
      const bootshausVenue =
        event.venueId === 'staging-seed-venue-bootshaus' ||
        event.venueId === 'venue-bootshaus-koeln' ||
        /bootshaus/i.test(venue.name ?? '');
      const externalTitle =
        /kitkat|mallorca|essigfabrik|stuttgart|hagen|festival|elektroküche|ship|airport/i.test(event.title) ||
        Boolean(event.venueCity && !/köln|koeln|cologne/i.test(event.venueCity));
      const blocked = bootshausVenue && externalTitle;
      repairs.push({
        eventId: event.id,
        title: event.title,
        issue: 'missing_coordinates_with_venue_row',
        venueId: event.venueId,
        venueRowName: venue.name,
        proposedCoordinates: blocked ? undefined : { lat: venue.latitude, lng: venue.longitude },
        blocked,
        blocker: blocked ? 'bootshaus_venue_linked_to_external_event_requires_review' : null,
      });
    }
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    gate: 'E',
    count: repairs.filter((r) => !r.blocked).length,
    repairs,
  };
  writeJson('_phase477_venue_repair_preview.json', payload);
  return payload;
}

function classifyByGate(items: RepairabilityItem[]) {
  const gates: Record<string, RepairabilityItem[]> = {
    gate0: [],
    gateA: [],
    gateB: [],
    gateC: [],
    gateD: [],
    gateE: [],
  };
  for (const item of items) {
    if (isInternalEntityId(item.eventId) || item.eventId === 'klangkuenstler-berghain') {
      gates.gate0.push(item);
    } else if (TICKET_DEST_CODES.has(item.code)) {
      gates.gateA.push(item);
    } else if (item.code.includes('lineup') || item.eventId === MDMA_1010_ID) {
      gates.gateC.push(item);
    } else if (item.code.includes('venue') || item.code.includes('coordinate')) {
      gates.gateE.push(item);
    } else if (item.code.includes('price') || item.code.includes('ticketio')) {
      gates.gateB.push(item);
    } else {
      gates.gateD.push(item);
    }
  }
  return gates;
}

async function buildBlockedMatrix(events: AdminEventRecord[]) {
  const repairabilityPath = join(OUT, '_phase4751_repairability.json');
  const parsed = JSON.parse(readFileSync(repairabilityPath, 'utf8')) as {
    byClass: Record<string, RepairabilityItem[]>;
    totals: Record<string, number>;
  };
  const realEvents = events.filter((e) => !isStagingFixture(e));
  return {
    generatedAt: new Date().toISOString(),
    publishedRealEvents: realEvents.length,
    publishedStagingFixtures: events.length - realEvents.length,
    blockedCounts: parsed.totals,
    reclassifications: {
      leviPrice: {
        eventId: LEVI_ID,
        from: 'repairable_now',
        to: 'blocked_by_missing_public_evidence',
        blocker: 'DETAIL_EXTERNALLY_BLOCKED_LIST_HAS_NO_PRICE (ALTCHA)',
      },
      gateDIncompleteProjection: {
        note: 'Reclassify to blocked/review when missing canonical venue or lineup evidence',
        count: parsed.byClass.repairable_now?.filter((i) => i.code === 'incomplete_projection').length ?? 0,
      },
    },
  };
}

async function runAudit(): Promise<Record<string, unknown>> {
  const events = await loadPublishedEvents();
  const repairable = loadRepairability();
  const byGate = classifyByGate(repairable);
  const staging = await previewStaging(events);
  const ticketDest = await previewTicketDestinations(events);
  const ticketIo = await previewTicketIo(events);
  const mdma = await previewMdmaArtists(events);
  const projections = await previewProjections(events);
  const venues = await previewVenues(events);
  const blocked = await buildBlockedMatrix(events);

  writeJson('_phase477_blocked_issue_matrix.json', blocked);

  const summary = {
    generatedAt: new Date().toISOString(),
    publishedTotal: events.length,
    repairableNowFrom4751: repairable.length,
    byGate: Object.fromEntries(Object.entries(byGate).map(([k, v]) => [k, v.length])),
    stagingFixtures: staging.count,
    gateAProposedMutations: ticketDest.palmaMutations.length,
    gateBRepairable: ticketIo.results.filter((r) => r.repairable).length,
    gateBBlocked: ticketIo.results.filter((r) => !r.repairable).length,
    gateCProposed: (mdma.mdma1010 as { proposedAction?: string })?.proposedAction,
    gateDRepairs: projections.count,
    gateERepairs: venues.count,
    levi: ticketIo.leviRequired,
    underland: ticketDest.underlandTrace,
  };
  writeJson('_phase477_before_after.json', { before: summary, after: null });
  return summary;
}

async function backupGate(gate: GateId) {
  const events = await loadPublishedEvents();
  const ids = new Set<string>();
  if (gate === '0') {
    events.filter(isStagingFixture).forEach((e) => ids.add(e.id));
  } else if (gate === 'A') {
    PALMA_SHOP_ROOT_IDS.forEach((id) => ids.add(id));
  } else if (gate === 'B') {
    const preview = JSON.parse(readFileSync(join(OUT, '_phase477_ticketio_connector_preview.json'), 'utf8')) as {
      results: Array<{ eventId: string; repairable: boolean }>;
    };
    preview.results.filter((r) => r.repairable).forEach((r) => ids.add(r.eventId));
  } else if (gate === 'C') {
    ids.add(MDMA_1010_ID);
  }
  const backup = [];
  for (const id of ids) {
    const event = events.find((e) => e.id === id);
    if (event) {
      backup.push({
        eventId: id,
        status: event.status,
        ticketUrl: event.ticketUrl,
        websiteUrl: event.websiteUrl,
        priceText: event.priceText,
        ticketStatus: event.ticketStatus,
        lineup: await snapshotMdmaLineup(id),
      });
    }
  }
  writeJson(`_phase477_gate_${gate}_backup.json`, { gate, generatedAt: new Date().toISOString(), backup });
  return backup.length;
}

function appendRepairRun(run: RepairRun): void {
  const path = join(OUT, '_phase477_repair_runs.json');
  const existing = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as { runs: RepairRun[] }).runs
    : [];
  writeJson('_phase477_repair_runs.json', { runs: [...existing, run] });
}

async function repairStaging(pass = 1): Promise<number> {
  const previewIds = loadStagingPreviewIds();
  const events = (await loadPublishedEvents()).filter((event) => isApprovedStagingFixture(event, previewIds));
  const mutations = [];
  for (const event of events) {
    const before = eventForbiddenFingerprint(event);
    const { data, error } = await opsClient()
      .from('events')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', event.id)
      .eq('status', 'published')
      .select('id');
    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.length === 0) {
      continue;
    }
    const after = await loadEventById(event.id);
    if (after) {
      const afterFp = eventForbiddenFingerprint(after);
      for (const key of Object.keys(before) as Array<keyof typeof before>) {
        if (before[key] !== afterFp[key]) {
          throw new Error(`Gate 0 forbidden mutation on ${event.id}: ${key}`);
        }
      }
    }
    mutations.push({ eventId: event.id, action: 'archived', pass });
  }
  if (mutations.length > 0) {
    await invalidateCaches();
  }
  appendRepairRun({
    gate: '0',
    command: 'repair-staging',
    pass,
    generatedAt: new Date().toISOString(),
    mutations: mutations.length,
    events: mutations,
  });
  return mutations.length;
}

async function repairTicketDestinations(pass = 1): Promise<number> {
  const events = await loadPublishedEvents();
  const mutations = [];
  for (const eventId of PALMA_SHOP_ROOT_IDS) {
    const event = events.find((e) => e.id === eventId);
    if (!event || !isTicketIoShopRootUrl(event.ticketUrl ?? '')) {
      continue;
    }
    const { error } = await opsClient()
      .from('events')
      .update({
        ticket_url: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', eventId);
    if (error) {
      throw new Error(error.message);
    }
    mutations.push({ eventId, clearedTicketUrl: true, websiteUrl: event.websiteUrl });
  }
  if (mutations.length > 0) {
    await invalidateCaches();
  }
  appendRepairRun({
    gate: 'A',
    command: 'repair-ticket-destinations',
    pass,
    generatedAt: new Date().toISOString(),
    mutations: mutations.length,
    events: mutations,
  });
  return mutations.length;
}

async function repairTicketIo(pass = 1): Promise<number> {
  const preview = JSON.parse(readFileSync(join(OUT, '_phase477_ticketio_connector_preview.json'), 'utf8')) as {
    results: Array<{ eventId: string; repairable: boolean; proposedMutation: { priceText: string; ticketStatus?: string } | null }>;
  };
  const events = await loadPublishedEvents();
  const mutations = [];
  for (const row of preview.results) {
    if (!row.repairable || !row.proposedMutation?.priceText) {
      continue;
    }
    const existing = events.find((e) => e.id === row.eventId) ?? null;
    const write = writeCanonicalTicketFields({
      existing,
      candidate: {
        priceText: row.proposedMutation.priceText,
        ticketStatus: row.proposedMutation.ticketStatus as never,
      } as never,
      fillOnly: false,
    });
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (write.patch.priceText !== undefined) {
      dbPatch.price_text = write.patch.priceText;
    }
    if (write.patch.ticketStatus !== undefined) {
      dbPatch.ticket_status = write.patch.ticketStatus;
    }
    if (Object.keys(dbPatch).length <= 1) {
      continue;
    }
    const { error } = await opsClient().from('events').update(dbPatch as never).eq('id', row.eventId);
    if (error) {
      throw new Error(error.message);
    }
    mutations.push({ eventId: row.eventId, priceText: row.proposedMutation.priceText });
  }
  if (mutations.length > 0) {
    await invalidateCaches();
  }
  appendRepairRun({
    gate: 'B',
    command: 'repair-ticketio',
    pass,
    generatedAt: new Date().toISOString(),
    mutations: mutations.length,
    events: mutations,
  });
  return mutations.length;
}

async function repairMdmaArtists(pass = 1): Promise<number> {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  const beforeEvent = await loadEventById(MDMA_1010_ID);
  if (!beforeEvent) {
    throw new Error(`MDMA event missing: ${MDMA_1010_ID}`);
  }
  const beforeForbidden = eventForbiddenFingerprint(beforeEvent);
  const lineup = await snapshotMdmaLineup(MDMA_1010_ID);
  const lineupEmpty = lineup.structuredEntries.length === 0 && lineup.legacyArtists.length === 0;
  if (lineupEmpty) {
    appendRepairRun({
      gate: 'C',
      command: 'repair-mdma-artists',
      pass,
      generatedAt: new Date().toISOString(),
      mutations: 0,
      events: [{ eventId: MDMA_1010_ID, skipped: 'lineup_already_empty' }],
    });
    return 0;
  }

  const garbageIds = new Set<string>();
  const garbageNames: string[] = [];
  for (const entry of lineup.structuredEntries as Array<{
    event_lineup_entry_artists?: Array<{ artist_id?: string; artists?: { name?: string } | null }>;
  }>) {
    for (const link of entry.event_lineup_entry_artists ?? []) {
      const name = link.artists?.name ?? '';
      if (name && !evaluateArtistCandidate({ name, sourceField: 'lineup' }).accepted && link.artist_id) {
        garbageIds.add(link.artist_id);
        garbageNames.push(name);
      }
    }
  }

  await registry.eventLineupService.replaceStructuredLineupFromImport(MDMA_1010_ID, []);
  await registry.eventLineupService.replaceFromImportPipeline(MDMA_1010_ID, []);

  const allArtists = await registry.adminArtistRepository.getAll();
  const artistsById = new Map(allArtists.map((artist) => [artist.id, artist]));
  const markCandidates: string[] = [];
  const skippedInUseElsewhere: string[] = [];
  for (const artistId of garbageIds) {
    const otherEvents = await artistLinkedEventIds(artistId, MDMA_1010_ID);
    if (otherEvents.length > 0) {
      skippedInUseElsewhere.push(artistId);
      continue;
    }
    markCandidates.push(artistId);
  }
  const marked = await markInvalidLineupArtifacts({
    artistIds: markCandidates,
    artistsById,
    saveArtist: (artist) => registry.adminArtistRepository.save(artist),
  });

  const afterEvent = await loadEventById(MDMA_1010_ID);
  if (afterEvent) {
    const afterForbidden = eventForbiddenFingerprint(afterEvent);
    for (const key of Object.keys(beforeForbidden) as Array<keyof typeof beforeForbidden>) {
      if (beforeForbidden[key] !== afterForbidden[key]) {
        throw new Error(`Gate C forbidden mutation: ${key}`);
      }
    }
  }

  await invalidateCaches();
  appendRepairRun({
    gate: 'C',
    command: 'repair-mdma-artists',
    pass,
    generatedAt: new Date().toISOString(),
    mutations: 1 + marked.markedLegacy.length,
    events: [{
      eventId: MDMA_1010_ID,
      clearedLineup: true,
      provenance: 'ticket_kings_related_events_sidebar_contamination',
      garbageNames,
      markedArtifacts: marked.markedLegacy,
      skippedInUseElsewhere,
      skippedMarking: marked.skipped,
    }],
  });
  return 1 + marked.markedLegacy.length;
}

async function repairProjections(pass = 1): Promise<number> {
  const preview = JSON.parse(readFileSync(join(OUT, '_phase477_projection_repair_preview.json'), 'utf8')) as {
    repairs: Array<{ eventId: string; issues: string[] }>;
  };
  let count = 0;
  for (const row of preview.repairs) {
    if (row.issues.includes('cache_freshness') || row.issues.includes('price_display_mismatch')) {
      count += 1;
    }
  }
  if (count > 0) {
    await invalidateCaches();
  }
  appendRepairRun({
    gate: 'D',
    command: 'repair-projections',
    pass,
    generatedAt: new Date().toISOString(),
    mutations: count,
    events: preview.repairs,
  });
  return count;
}

async function repairVenues(pass = 1): Promise<number> {
  const preview = JSON.parse(readFileSync(join(OUT, '_phase477_venue_repair_preview.json'), 'utf8')) as {
    repairs: Array<{ eventId: string; blocked?: boolean; proposedVenueName?: string; proposedCoordinates?: { lat: number; lng: number } }>;
  };
  const mutations = [];
  for (const row of preview.repairs) {
    if (row.blocked) {
      continue;
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (row.proposedVenueName) {
      patch.venue_name = row.proposedVenueName;
    }
    if (row.proposedCoordinates) {
      patch.latitude = row.proposedCoordinates.lat;
      patch.longitude = row.proposedCoordinates.lng;
    }
    if (Object.keys(patch).length <= 1) {
      continue;
    }
    const { error } = await opsClient().from('events').update(patch).eq('id', row.eventId);
    if (error) {
      throw new Error(error.message);
    }
    mutations.push({ eventId: row.eventId, patch });
  }
  if (mutations.length > 0) {
    await invalidateCaches();
  }
  appendRepairRun({
    gate: 'E',
    command: 'repair-venues',
    pass,
    generatedAt: new Date().toISOString(),
    mutations: mutations.length,
    events: mutations,
  });
  return mutations.length;
}

async function writeReport(summary: Record<string, unknown>): Promise<void> {
  const md = `# Phase 4.7.7 — Root-Cause Production Repair

Generated: ${new Date().toISOString()}

## Status

**AWAITING GATE APPROVAL** — No mutations executed until explicit approval per gate.

## Summary

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

## Gates

| Gate | Domain | Preview artifact |
|------|--------|------------------|
| 0 | Staging fixture lifecycle | \`_phase477_staging_cleanup_preview.json\` |
| A | Ticket destinations | \`_phase477_ticket_destination_preview.json\` |
| B | Ticket.io price/status | \`_phase477_ticketio_connector_preview.json\` |
| C | MDMA / lineup integrity | \`_phase477_mdma_artist_repair_preview.json\` |
| D | Projection / cache | \`_phase477_projection_repair_preview.json\` |
| E | Venue fields | \`_phase477_venue_repair_preview.json\` |

## Authoritative inputs

- Phase 4.7.5.1 global truth audit
- Phase 4.7.6 pipeline truth report

See \`docs/real-data/_phase477_blocked_issue_matrix.json\` for blocked issue classes.
`;
  writeFileSync(REPORT, md);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const passArg = rest.find((a) => a.startsWith('--pass='));
  const pass = passArg ? Number(passArg.split('=')[1]) : 1;
  const gateArg = rest.find((a) => a.startsWith('--gate='));
  const gate = (gateArg?.split('=')[1] ?? '0') as GateId;

  switch (command) {
    case 'audit':
    case 'full-audit': {
      const summary = await runAudit();
      await writeReport(summary);
      console.log(JSON.stringify(summary, null, 2));
      break;
    }
    case 'preview-staging':
      console.log(JSON.stringify(await previewStaging(await loadPublishedEvents()), null, 2));
      break;
    case 'preview-ticket-destinations':
      console.log(JSON.stringify(await previewTicketDestinations(await loadPublishedEvents()), null, 2));
      break;
    case 'preview-ticketio':
      console.log(JSON.stringify(await previewTicketIo(await loadPublishedEvents()), null, 2));
      break;
    case 'preview-mdma-artists':
      console.log(JSON.stringify(await previewMdmaArtists(await loadPublishedEvents()), null, 2));
      break;
    case 'preview-projections':
      console.log(JSON.stringify(await previewProjections(await loadPublishedEvents()), null, 2));
      break;
    case 'preview-venues':
      console.log(JSON.stringify(await previewVenues(await loadPublishedEvents()), null, 2));
      break;
    case 'backup-gate': {
      const count = await backupGate(gate);
      console.log(`Backed up ${count} events for gate ${gate}`);
      break;
    }
    case 'repair-staging':
      console.log(`Gate 0 mutations: ${await repairStaging(pass)}`);
      break;
    case 'repair-ticket-destinations':
      console.log(`Gate A mutations: ${await repairTicketDestinations(pass)}`);
      break;
    case 'repair-ticketio':
      console.log(`Gate B mutations: ${await repairTicketIo(pass)}`);
      break;
    case 'repair-mdma-artists':
      console.log(`Gate C mutations: ${await repairMdmaArtists(pass)}`);
      break;
    case 'repair-projections':
      console.log(`Gate D mutations: ${await repairProjections(pass)}`);
      break;
    case 'repair-venues':
      console.log(`Gate E mutations: ${await repairVenues(pass)}`);
      break;
    case 'audit-after': {
      const summary = await runAudit();
      writeJson('_phase477_final_truth_audit.json', summary);
      console.log(JSON.stringify(summary, null, 2));
      break;
    }
    case 'report': {
      const summary = existsSync(join(OUT, '_phase477_before_after.json'))
        ? (JSON.parse(readFileSync(join(OUT, '_phase477_before_after.json'), 'utf8')) as { before: Record<string, unknown> }).before
        : await runAudit();
      await writeReport(summary);
      console.log('Report written:', REPORT);
      break;
    }
    default:
      console.error(`Unknown command: ${command ?? '(none)'}`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
