/**
 * Phase 4.7.4 Workstream 1 — Ticket.io completion and production acceptance.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4741-ticketio-completion.ts <command>
 *
 * Commands:
 *   baseline | repair-bc173 | preview-prices | preview-availability | preview-soldout
 *   audit-shop-roots | profile-unregistered-shops | verify-presentation | acceptance | report | full
 *
 * `full` is read-only except when `repair-bc173` is invoked separately with approval.
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import {
  classifyTicketIoPriceFailure,
  discoverTicketIoPriceEvidence,
  type TicketIoPriceFailureClass,
  type TicketIoPriceEvidenceDiscovery,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { isTicketIoPowChallengePage } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import { formatDisplayPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import {
  extractTicketIoEventSlugFromUrl,
  parseAllTicketIoListRowContexts,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-enrichment';
import {
  listRegisteredTicketIoShopProfiles,
  resolveTicketIoPriceStrategy,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-strategy-registry';
import { normalizeCanonicalTicketAvailability } from '@/features/events/domain/canonical-ticket-availability';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import {
  resolveTicketProviderPresentationLabel,
  resolveTicketPlatformSlug,
} from '@/features/events/formatting/ticket-platform-presentation';
import { resolvePublicTicketPresentation } from '@/features/events/formatting/ticket-presentation';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const REPORT = join(ROOT, 'docs/PHASE_4741_TICKETIO_COMPLETION_REPORT.md');

const BC173_EVENT_ID = 'evt-1785339410908-9691748';
const BC173_EXPECTED_SLUG = 'BcDqml12';

const UNREGISTERED_SHOPS = [
  'blacklist-festival',
  'polyamor',
  'unreal-bootshaus',
  'bootshaus-tickets',
] as const;

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

export type TicketIoAcceptanceState =
  | 'complete_price_and_availability'
  | 'price_only'
  | 'availability_only'
  | 'list_supported_detail_blocked'
  | 'event_not_on_accessible_list'
  | 'shop_root_without_event_id'
  | 'public_evidence_absent'
  | 'review_required';

export type AvailabilityEvidenceState =
  | 'available'
  | 'limited'
  | 'sold_out'
  | 'presale'
  | 'coming_soon'
  | 'waitlist'
  | 'sales_ended'
  | 'unavailable'
  | 'unknown';

type LineupFingerprint = {
  structuredCount: number;
  legacyCount: number;
  artistNamesHash: string;
};

type ForbiddenFingerprint = {
  ticketUrl: string;
  websiteUrl: string;
  descriptionHash: string;
  genreLabelsHash: string;
  venueId: string;
  organizerId: string;
  imageUrl: string;
  flyerUrl: string;
  sourceId: string;
  eventAttributesHash: string;
  lineup: LineupFingerprint;
};

interface BaselineEventRecord {
  eventId: string;
  title: string;
  startDate: string;
  purchaseUrl: string;
  shopHost: string;
  eventSlug: string | null;
  sourceId: string | null;
  sourceRegistered: boolean;
  sourceEnabled: boolean | null;
  accessibleListUrl: string;
  listAccessible: boolean;
  detailAltchaBlocked: boolean;
  priceEvidence: TicketIoPriceEvidenceDiscovery['bestHit'];
  availabilityEvidence: {
    state: AvailabilityEvidenceState;
    reason: string;
    surfaces: string[];
    soldOutFromList: boolean;
  };
  phasesEvidence: { count: number; surfaces: string[] };
  canonical: {
    priceText?: string;
    ticketStatus?: string;
    ticketPhasesCount: number;
    availability: string;
  };
  viewModel: {
    providerLabel: string;
    displayPriceText?: string;
    availabilityLabel?: string;
    ctaLabel?: string;
  };
  failureClass: TicketIoPriceFailureClass;
  acceptanceState: TicketIoAcceptanceState;
}

const listHtmlCache = new Map<string, string>();
let baselineCache: BaselineEventRecord[] = [];

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

function hashNames(names: string[]): string {
  return createHash('sha256').update(names.sort().join('|')).digest('hex').slice(0, 16);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

function extractShopSlug(url: string): string | undefined {
  const match = url.match(/https?:\/\/([a-z0-9-]+)\.ticket\.io/i);
  return match?.[1]?.toLowerCase();
}

function isTicketIoSource(source: Record<string, unknown>): boolean {
  const id = String(source.id ?? '');
  const config = (source.source_config ?? {}) as Record<string, unknown>;
  const ticketPlatform = (config.ticketPlatform ?? {}) as Record<string, unknown>;
  return ticketPlatform.platform === 'ticket_io' || /ticket-io/i.test(id);
}

function shopHostFromSource(source: Record<string, unknown>): string {
  const config = (source.source_config ?? {}) as Record<string, unknown>;
  const ticketPlatform = (config.ticketPlatform ?? {}) as Record<string, unknown>;
  const shopSlug = String(ticketPlatform.shopSlug ?? '').trim().toLowerCase();
  if (shopSlug) {
    return `${shopSlug}.ticket.io`;
  }
  const listUrl = String(ticketPlatform.listUrl ?? config.url ?? '');
  const fromUrl = extractShopSlug(listUrl);
  return fromUrl ? `${fromUrl}.ticket.io` : 'unknown.ticket.io';
}

async function getListHtml(shopHost: string, listUrl: string): Promise<string> {
  if (listHtmlCache.has(shopHost)) {
    return listHtmlCache.get(shopHost)!;
  }
  try {
    const html = await fetchHtml(listUrl);
    listHtmlCache.set(shopHost, html);
    return html;
  } catch {
    listHtmlCache.set(shopHost, '');
    return '';
  }
}

async function loadPublishedTicketIoEvents(): Promise<AdminEventRecord[]> {
  const { data } = await opsClient().from('events').select('*').eq('status', 'published');
  return (data ?? [])
    .map((row) => mapEventRowToAdminRecord(row as EventRow))
    .filter((event) => /\.ticket\.io/i.test(event.ticketUrl ?? ''));
}

async function loadTicketIoSources(): Promise<Map<string, Record<string, unknown>>> {
  const { data } = await opsClient().from('sources').select('*');
  const map = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    const source = row as Record<string, unknown>;
    if (isTicketIoSource(source)) {
      map.set(String(source.id), source);
    }
  }
  return map;
}

function uiPriceVisible(event: AdminEventRecord): boolean {
  const canonical = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  const label = formatDisplayPriceText(canonical.priceText ?? event.priceText);
  return Boolean(label && label !== 'Ausverkauft');
}

function deriveAvailabilityEvidence(
  discovery: TicketIoPriceEvidenceDiscovery,
  listHtml: string,
  eventSlug: string | null,
): BaselineEventRecord['availabilityEvidence'] {
  const surfaces: string[] = [];
  let soldOutFromList = false;

  if (discovery.bestHit?.soldOut) {
    soldOutFromList = true;
    surfaces.push(discovery.bestHit.surface);
    return { state: 'sold_out', reason: 'list_row_or_card_sold_out_label', surfaces, soldOutFromList };
  }

  for (const hit of discovery.hits) {
    if (hit.soldOut) {
      soldOutFromList = true;
      surfaces.push(hit.surface);
      return { state: 'sold_out', reason: 'explicit_sold_out_on_list_surface', surfaces, soldOutFromList };
    }
  }

  const rows = eventSlug ? parseAllTicketIoListRowContexts(listHtml) : new Map();
  const row = eventSlug ? rows.get(eventSlug) : undefined;
  if (row?.soldOut) {
    soldOutFromList = true;
    surfaces.push('list_row_context');
    return { state: 'sold_out', reason: 'list_row_context_sold_out', surfaces, soldOutFromList };
  }

  if (/presale|vorverkauf/i.test(listHtml) && eventSlug && listHtml.includes(eventSlug)) {
    surfaces.push('list_html_presale_label');
    return { state: 'presale', reason: 'presale_label_on_accessible_list', surfaces, soldOutFromList };
  }

  if (/warteliste|waitlist/i.test(listHtml) && eventSlug && listHtml.includes(eventSlug)) {
    surfaces.push('list_html_waitlist_label');
    return { state: 'waitlist', reason: 'waitlist_label_on_accessible_list', surfaces, soldOutFromList };
  }

  if (discovery.listAccessible && discovery.listJsonLdOfferCount > 0) {
    surfaces.push('list_json_ld');
    if (discovery.bestHit?.priceText) {
      return {
        state: 'available',
        reason: 'json_ld_instock_with_price_on_accessible_list',
        surfaces,
        soldOutFromList,
      };
    }
    return {
      state: 'unknown',
      reason: 'json_ld_present_without_explicit_availability_or_price_for_event',
      surfaces,
      soldOutFromList,
    };
  }

  if (discovery.listAccessible && row?.priceText) {
    surfaces.push('list_row_price_without_status');
    return {
      state: 'unknown',
      reason: 'list_price_without_explicit_availability_signal',
      surfaces,
      soldOutFromList,
    };
  }

  if (!discovery.listAccessible) {
    return {
      state: 'unknown',
      reason: 'list_not_accessible_or_altcha_blocked',
      surfaces,
      soldOutFromList,
    };
  }

  if (!eventSlug) {
    return {
      state: 'unknown',
      reason: 'shop_root_url_without_event_slug',
      surfaces,
      soldOutFromList,
    };
  }

  if (discovery.listRowCount > 0 && !rows.has(eventSlug)) {
    return {
      state: 'unknown',
      reason: 'event_slug_not_found_on_accessible_list',
      surfaces,
      soldOutFromList,
    };
  }

  return {
    state: 'unknown',
    reason: 'no_explicit_availability_evidence_on_accessible_surfaces',
    surfaces,
    soldOutFromList,
  };
}

function deriveAcceptanceState(input: {
  event: AdminEventRecord;
  discovery: TicketIoPriceEvidenceDiscovery;
  classification: { failure: TicketIoPriceFailureClass };
  availabilityEvidence: BaselineEventRecord['availabilityEvidence'];
  canonicalAvailability: string;
}): TicketIoAcceptanceState {
  const hasPrice = uiPriceVisible(input.event);
  const hasAvailability =
    input.canonicalAvailability !== 'unknown' ||
    input.availabilityEvidence.state !== 'unknown';

  if (input.classification.failure === 'SHOP_ROOT_WITHOUT_EVENT_ID') {
    return 'shop_root_without_event_id';
  }
  if (input.classification.failure === 'EVENT_NOT_PRESENT_ON_ACCESSIBLE_LIST') {
    return 'event_not_on_accessible_list';
  }
  if (input.classification.failure === 'REVIEW_REQUIRED') {
    return 'review_required';
  }

  if (hasPrice && hasAvailability) {
    return 'complete_price_and_availability';
  }
  if (hasPrice) {
    return 'price_only';
  }
  if (hasAvailability) {
    return 'availability_only';
  }

  if (
    input.discovery.detailAltchaBlocked &&
    input.discovery.listAccessible &&
    (input.discovery.bestHit || input.classification.failure === 'LIST_PRICE_AVAILABLE_NOT_EXTRACTED')
  ) {
    return 'list_supported_detail_blocked';
  }

  if (input.discovery.listAccessible && !input.discovery.bestHit) {
    return 'public_evidence_absent';
  }

  return 'public_evidence_absent';
}

async function buildBaseline(): Promise<BaselineEventRecord[]> {
  const events = await loadPublishedTicketIoEvents();
  const sources = await loadTicketIoSources();
  const registeredHosts = new Set<string>();
  for (const source of sources.values()) {
    registeredHosts.add(shopHostFromSource(source));
  }

  const records: BaselineEventRecord[] = [];

  for (const event of events) {
    const shopSlug = extractShopSlug(event.ticketUrl ?? '') ?? 'unknown';
    const shopHost = `${shopSlug}.ticket.io`;
    const listUrl = `https://${shopHost}/`;
    const listHtml = await getListHtml(shopHost, listUrl);
    const eventSlug = extractTicketIoEventSlugFromUrl(event.ticketUrl ?? '') ?? null;

    let detailHtml: string | undefined;
    if (eventSlug && event.ticketUrl) {
      try {
        detailHtml = await fetchHtml(event.ticketUrl);
      } catch {
        detailHtml = undefined;
      }
    }

    const discovery = discoverTicketIoPriceEvidence({
      shopSlug,
      listUrl,
      listHtml,
      eventUrl: event.ticketUrl,
      detailHtml,
    });

    const canonical = readCanonicalTicket({
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
    });

    const classification = classifyTicketIoPriceFailure({
      hasEventSlug: Boolean(eventSlug),
      isShopRootUrl: !eventSlug,
      discovery,
      dbPriceText: event.priceText,
      canonicalPriceText: canonical.priceText,
      uiPriceVisible: uiPriceVisible(event),
    });

    const availabilityEvidence = deriveAvailabilityEvidence(discovery, listHtml, eventSlug);
    const canonicalAvailability = normalizeCanonicalTicketAvailability({
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
      priceText: event.priceText,
    });

    const platformSlug = resolveTicketPlatformSlug(event.ticketUrl, 'ticket.io');
    const providerLabel = resolveTicketProviderPresentationLabel({
      purchaseUrl: event.ticketUrl,
      ticketPlatform: platformSlug,
    });
    const presentation = resolvePublicTicketPresentation({
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: canonical.priceText ?? event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
      ticketPlatform: platformSlug,
    });

    const source = event.sourceId ? sources.get(event.sourceId) : undefined;

    records.push({
      eventId: event.id,
      title: event.title,
      startDate: event.startDate,
      purchaseUrl: event.ticketUrl ?? '',
      shopHost,
      eventSlug,
      sourceId: event.sourceId ?? null,
      sourceRegistered: registeredHosts.has(shopHost),
      sourceEnabled: source ? Boolean(source.enabled) : null,
      accessibleListUrl: listUrl,
      listAccessible: discovery.listAccessible,
      detailAltchaBlocked: discovery.detailAltchaBlocked,
      priceEvidence: discovery.bestHit,
      availabilityEvidence,
      phasesEvidence: {
        count: event.ticketPhases?.length ?? 0,
        surfaces: discovery.detailAltchaBlocked ? ['list_only_detail_blocked'] : ['list', 'detail_if_accessible'],
      },
      canonical: {
        priceText: canonical.priceText ?? event.priceText,
        ticketStatus: event.ticketStatus,
        ticketPhasesCount: event.ticketPhases?.length ?? 0,
        availability: canonicalAvailability,
      },
      viewModel: {
        providerLabel,
        displayPriceText: presentation.priceLabel,
        availabilityLabel: presentation.availabilityLabel,
        ctaLabel: presentation.ctaLabel,
      },
      failureClass: classification.failure,
      acceptanceState: deriveAcceptanceState({
        event,
        discovery,
        classification,
        availabilityEvidence,
        canonicalAvailability,
      }),
    });
  }

  baselineCache = records;
  return records;
}

async function runBaseline(): Promise<void> {
  const records = await buildBaseline();
  const hosts = [...new Set(records.map((row) => row.shopHost))].sort();

  writeJson('_phase4741_ticketio_baseline.json', {
    generatedAt: new Date().toISOString(),
    publishedTicketIoEvents: records.length,
    observedShopHosts: hosts,
    registeredEnabledSources: (await loadTicketIoSources()).size,
    events: records,
    summary: {
      withPublicPriceEvidence: records.filter((row) => row.priceEvidence?.priceText).length,
      withCanonicalUiPrice: records.filter((row) => row.canonical.priceText?.trim()).length,
      withExplicitAvailability: records.filter((row) => row.canonical.availability !== 'unknown').length,
      failureClasses: records.reduce<Record<string, number>>((acc, row) => {
        acc[row.failureClass] = (acc[row.failureClass] ?? 0) + 1;
        return acc;
      }, {}),
      acceptanceStates: records.reduce<Record<string, number>>((acc, row) => {
        acc[row.acceptanceState] = (acc[row.acceptanceState] ?? 0) + 1;
        return acc;
      }, {}),
    },
  });

  console.log(`Phase 4.7.4.1 baseline: ${records.length} Ticket.io events across ${hosts.length} hosts`);
}

async function lineupFingerprint(eventId: string): Promise<LineupFingerprint> {
  const client = opsClient();
  const [{ count: structuredCount }, { count: legacyCount }, { data: legacy }] = await Promise.all([
    client.from('event_lineup_entries').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_artists').select('artist_id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_artists').select('artists(name)').eq('event_id', eventId).order('sort_order'),
  ]);
  const names = (legacy ?? [])
    .map((row) => (row.artists as { name?: string } | null)?.name)
    .filter((name): name is string => Boolean(name));
  return {
    structuredCount: structuredCount ?? 0,
    legacyCount: legacyCount ?? 0,
    artistNamesHash: hashNames(names),
  };
}

function forbiddenFingerprint(event: AdminEventRecord, lineup: LineupFingerprint): ForbiddenFingerprint {
  return {
    ticketUrl: event.ticketUrl ?? '',
    websiteUrl: event.websiteUrl ?? '',
    descriptionHash: hashValue(event.description),
    genreLabelsHash: hashValue(event.genreLabels),
    venueId: event.venueId ?? '',
    organizerId: event.organizerId ?? '',
    imageUrl: event.imageUrl ?? '',
    flyerUrl: event.flyerUrl ?? '',
    sourceId: event.sourceId ?? '',
    eventAttributesHash: hashValue(event.eventAttributes),
    lineup,
  };
}

function buildListAdmissionPhase(hit: NonNullable<TicketIoPriceEvidenceDiscovery['bestHit']>): CanonicalTicketPhase[] {
  return [
    {
      id: 'admission-list-evidence',
      name: 'Admission',
      sortOrder: 0,
      kind: 'regular',
      priceAmount: hit.priceAmount,
      priceCurrency: 'EUR',
      priceLabel: hit.priceText,
      soldOut: hit.soldOut ?? false,
      available: !hit.soldOut,
      note: `surface:${hit.surface}`,
    },
  ];
}

function ticketPhasesSemanticallyEqual(
  left: CanonicalTicketPhase[] | undefined,
  right: CanonicalTicketPhase[] | undefined,
): boolean {
  const normalize = (phases: CanonicalTicketPhase[] | undefined) =>
    (phases ?? []).map((phase) => ({
      id: phase.id,
      name: phase.name,
      kind: phase.kind,
      sortOrder: phase.sortOrder,
      priceAmount: phase.priceAmount,
      priceCurrency: phase.priceCurrency,
      priceLabel: phase.priceLabel,
      soldOut: phase.soldOut,
      available: phase.available,
      note: phase.note,
    }));

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

async function runRepairBc173(): Promise<void> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', BC173_EVENT_ID).maybeSingle();
  if (error || !data) {
    throw new Error(`BC173 event not found: ${error?.message ?? BC173_EVENT_ID}`);
  }

  const event = mapEventRowToAdminRecord(data as EventRow);
  const beforeLineup = await lineupFingerprint(event.id);
  const beforeForbidden = forbiddenFingerprint(event, beforeLineup);

  const shopHost = 'bootshaus-club.ticket.io';
  const listUrl = `https://${shopHost}/`;
  const listHtml = await fetchHtml(listUrl);
  if (isTicketIoPowChallengePage(listHtml)) {
    throw new Error('BC173 repair blocked: list page ALTCHA challenge detected');
  }

  const discovery = discoverTicketIoPriceEvidence({
    shopSlug: 'bootshaus-club',
    listUrl,
    listHtml,
    eventUrl: event.ticketUrl,
  });

  const slug = extractTicketIoEventSlugFromUrl(event.ticketUrl ?? '');
  if (slug !== BC173_EXPECTED_SLUG) {
    throw new Error(`BC173 slug mismatch: expected ${BC173_EXPECTED_SLUG}, got ${slug ?? 'null'}`);
  }
  if (!/bc173/i.test(event.title) || !/loco/i.test(event.title)) {
    throw new Error(`BC173 title mismatch: ${event.title}`);
  }
  if (!discovery.bestHit?.priceText?.includes('23')) {
    throw new Error(`BC173 price evidence mismatch: ${discovery.bestHit?.priceText ?? 'none'}`);
  }

  const priceText = discovery.bestHit.priceText;
  const ticketPhases = buildListAdmissionPhase(discovery.bestHit);
  const ticketStatus = discovery.bestHit.soldOut ? 'sold_out' : 'on_sale';

  const backup = {
    generatedAt: new Date().toISOString(),
    eventId: event.id,
    title: event.title,
    before: {
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
    },
    evidence: discovery.bestHit,
    forbiddenDomainFingerprint: beforeForbidden,
    lineupFingerprint: beforeLineup,
  };
  writeJson('_phase4741_bc173_repair_backup.json', backup);

  const dbPatch = {
    price_text: priceText,
    ticket_status: ticketStatus,
    ticket_phases: ticketPhases,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await opsClient()
    .from('events')
    .update(dbPatch as never)
    .eq('id', event.id);
  if (updateError) {
    throw new Error(updateError.message);
  }

  const now = new Date().toISOString();
  const provenanceRows = [
    {
      id: `provenance-${event.id}-priceText`,
      canonical_event_id: event.id,
      field_path: 'priceText',
      selected_value: priceText,
      selected_source_id: event.sourceId,
      selected_at: now,
      selection_reason: 'phase4741_gate_c2_bc173_repair',
      alternatives: [{ surface: discovery.bestHit.surface, rawSnippet: discovery.bestHit.rawSnippet }],
      manually_overridden: false,
      updated_at: now,
    },
    {
      id: `provenance-${event.id}-ticketStatus`,
      canonical_event_id: event.id,
      field_path: 'ticketStatus',
      selected_value: ticketStatus,
      selected_source_id: event.sourceId,
      selected_at: now,
      selection_reason: 'phase4741_gate_c2_bc173_repair',
      alternatives: [],
      manually_overridden: false,
      updated_at: now,
    },
    {
      id: `provenance-${event.id}-ticketPhases`,
      canonical_event_id: event.id,
      field_path: 'ticketPhases',
      selected_value: { phases: ticketPhases, evidenceSource: 'list_card_html' },
      selected_source_id: event.sourceId,
      selected_at: now,
      selection_reason: 'phase4741_gate_c2_bc173_repair',
      alternatives: [],
      manually_overridden: false,
      updated_at: now,
    },
  ];
  for (const row of provenanceRows) {
    const { error: provError } = await opsClient().from('event_field_provenance').upsert(row, {
      onConflict: 'canonical_event_id,field_path',
    });
    if (provError) {
      throw new Error(provError.message);
    }
  }

  const afterRow = (await opsClient().from('events').select('*').eq('id', event.id).single()).data as EventRow;
  const afterEvent = mapEventRowToAdminRecord(afterRow);
  const afterLineup = await lineupFingerprint(event.id);
  const afterForbidden = forbiddenFingerprint(afterEvent, afterLineup);

  if (JSON.stringify(beforeLineup) !== JSON.stringify(afterLineup)) {
    throw new Error('BC173 repair: lineup mutation detected');
  }
  if (JSON.stringify(beforeForbidden) !== JSON.stringify(afterForbidden)) {
    throw new Error('BC173 repair: forbidden domain mutation detected');
  }

  await invalidateConsumerEventCaches();

  const pass2Discovery = discoverTicketIoPriceEvidence({
    shopSlug: 'bootshaus-club',
    listUrl,
    listHtml: await fetchHtml(listUrl),
    eventUrl: afterEvent.ticketUrl,
  });
  const pass2PriceText = pass2Discovery.bestHit?.priceText;
  const pass2TicketStatus = pass2Discovery.bestHit?.soldOut ? 'sold_out' : 'on_sale';
  const pass2TicketPhases = pass2Discovery.bestHit ? buildListAdmissionPhase(pass2Discovery.bestHit) : [];
  const pass2WouldMutate =
    afterEvent.priceText !== pass2PriceText ||
    afterEvent.ticketStatus !== pass2TicketStatus ||
    !ticketPhasesSemanticallyEqual(afterEvent.ticketPhases, pass2TicketPhases);

  const result = {
    generatedAt: new Date().toISOString(),
    applied: true,
    eventId: event.id,
    title: event.title,
    slug,
    evidence: discovery.bestHit,
    before: backup.before,
    after: {
      priceText: afterEvent.priceText,
      ticketStatus: afterEvent.ticketStatus,
      ticketPhases: afterEvent.ticketPhases,
    },
    pass2Idempotent: !pass2WouldMutate,
    pass2Mutations: pass2WouldMutate
      ? {
          priceText: afterEvent.priceText !== pass2PriceText ? pass2PriceText : undefined,
          ticketStatus: afterEvent.ticketStatus !== pass2TicketStatus ? pass2TicketStatus : undefined,
          ticketPhases:
            !ticketPhasesSemanticallyEqual(afterEvent.ticketPhases, pass2TicketPhases)
              ? pass2TicketPhases
              : undefined,
        }
      : null,
    forbiddenDomainsUnchanged: true,
    lineupUnchanged: true,
  };

  const runs = existsSync(join(OUT, '_phase4741_repair_runs.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase4741_repair_runs.json'), 'utf8')) as { runs: unknown[] }).runs
    : [];
  runs.push({ command: 'repair-bc173', ...result });
  writeJson('_phase4741_repair_runs.json', { runs });
  writeJson('_phase4741_bc173_repair.json', result);

  console.log(JSON.stringify(result, null, 2));
}

async function runPreviewPrices(): Promise<void> {
  const records = baselineCache.length > 0 ? baselineCache : await buildBaseline();
  const candidates = records
    .filter(
      (row) =>
        Boolean(row.priceEvidence?.priceText?.trim()) &&
        !row.canonical.priceText?.trim() &&
        Boolean(row.eventSlug),
    )
    .map((row) => ({
      eventId: row.eventId,
      title: row.title,
      purchaseUrl: row.purchaseUrl,
      shopHost: row.shopHost,
      eventSlug: row.eventSlug,
      publicPrice: row.priceEvidence?.priceText,
      canonicalPrice: row.canonical.priceText ?? null,
      availabilityEvidence: row.availabilityEvidence,
      extractionStrategy: row.priceEvidence?.surface,
      failureClass: row.failureClass,
      plannedMutation: {
        price_text: row.priceEvidence?.priceText ?? null,
        ticket_status: row.priceEvidence?.soldOut ? 'sold_out' : 'on_sale',
        ticket_phases: row.priceEvidence ? 'derived_from_list_evidence' : null,
      },
      approvalRequired: true,
      autoRepair: false,
    }));

  writeJson('_phase4741_price_backfill_preview.json', {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    candidateCount: candidates.length,
    candidates,
  });
  console.log(`Price backfill preview: ${candidates.length} evidence-backed candidates`);
}

async function runPreviewAvailability(): Promise<void> {
  const records = baselineCache.length > 0 ? baselineCache : await buildBaseline();
  const candidates = records
    .filter((row) => row.canonical.availability === 'unknown')
    .map((row) => ({
      eventId: row.eventId,
      title: row.title,
      shopHost: row.shopHost,
      currentCanonicalAvailability: row.canonical.availability,
      inferredFromEvidence: row.availabilityEvidence.state,
      unknownReason: row.availabilityEvidence.reason,
      evidenceSurfaces: row.availabilityEvidence.surfaces,
      plannedMutation:
        row.availabilityEvidence.state !== 'unknown'
          ? {
              ticket_status:
                row.availabilityEvidence.state === 'sold_out'
                  ? 'sold_out'
                  : row.availabilityEvidence.state === 'presale'
                    ? 'on_sale'
                    : 'on_sale',
            }
          : null,
      approvalRequired: true,
      autoRepair: false,
    }));

  writeJson('_phase4741_availability_preview.json', {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    unknownCount: candidates.length,
    explicitCandidateCount: candidates.filter((row) => row.plannedMutation).length,
    candidates,
  });
  console.log(
    `Availability preview: ${candidates.length} unknown; ${candidates.filter((row) => row.plannedMutation).length} with explicit evidence`,
  );
}

async function runPreviewSoldout(): Promise<void> {
  const records = baselineCache.length > 0 ? baselineCache : await buildBaseline();
  const mismatches = records.filter(
    (row) =>
      row.availabilityEvidence.state === 'sold_out' &&
      row.canonical.ticketStatus !== 'sold_out',
  );

  writeJson('_phase4741_soldout_preview.json', {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    mismatchCount: mismatches.length,
    candidates: mismatches.map((row) => ({
      eventId: row.eventId,
      title: row.title,
      rawSoldOutEvidence: row.availabilityEvidence,
      currentTicketStatus: row.canonical.ticketStatus,
      apiAvailability: row.canonical.availability,
      uiAvailabilityLabel: row.viewModel.availabilityLabel,
      plannedCorrection: { ticket_status: 'sold_out' },
      priceMutation: false,
      approvalRequired: true,
    })),
  });
  console.log(`Sold-out preview: ${mismatches.length} mismatches`);
}

async function runAuditShopRoots(): Promise<void> {
  const records = baselineCache.length > 0 ? baselineCache : await buildBaseline();
  const events = await loadPublishedTicketIoEvents();
  const eventById = new Map(events.map((event) => [event.id, event]));
  const shopRoots = records.filter((row) => row.acceptanceState === 'shop_root_without_event_id');

  const matrix = shopRoots.map((row) => {
    const event = eventById.get(row.eventId);
    let classification:
      | 'event_specific_url_found'
      | 'official_page_only'
      | 'shop_root_only'
      | 'external_platform_link_available'
      | 'review_required' = 'shop_root_only';

    if (/fourvenues\.com/i.test(event?.websiteUrl ?? '')) {
      classification = 'external_platform_link_available';
    } else if (event?.websiteUrl?.trim()) {
      classification = 'official_page_only';
    } else if (row.eventSlug) {
      classification = 'event_specific_url_found';
    } else if (row.priceEvidence?.priceText) {
      classification = 'review_required';
    }

    return {
      eventId: row.eventId,
      title: row.title,
      purchaseUrl: row.purchaseUrl,
      officialUrl: event?.websiteUrl ?? null,
      shopHost: row.shopHost,
      classification,
      listPriceEvidence: row.priceEvidence?.priceText,
      note: 'No slug fabrication; external platform links deferred to connector expansion gate',
    };
  });

  writeJson('_phase4741_shop_root_matrix.json', {
    generatedAt: new Date().toISOString(),
    count: matrix.length,
    events: matrix,
  });
  console.log(`Shop-root matrix: ${matrix.length} events`);
}

async function runProfileUnregisteredShops(): Promise<void> {
  const records = baselineCache.length > 0 ? baselineCache : await buildBaseline();
  const profiles = [];

  for (const shopSlug of UNREGISTERED_SHOPS) {
    const shopHost = `${shopSlug}.ticket.io`;
    const listUrl = `https://${shopHost}/`;
    let listHtml = '';
    let listAccessible = false;
    try {
      listHtml = await fetchHtml(listUrl);
      listAccessible = listHtml.length > 500 && !isTicketIoPowChallengePage(listHtml);
    } catch {
      listAccessible = false;
    }
    const strategy = resolveTicketIoPriceStrategy(shopSlug);
    const shopEvents = records.filter((row) => row.shopHost === shopHost);

    profiles.push({
      host: shopHost,
      shopSlug,
      publishedEventCount: shopEvents.length,
      accessibleListSurface: listAccessible,
      eventUrlPattern: `https://${shopHost}/{slug}/`,
      priceStrategy: strategy.strategy,
      availabilityStrategy: listAccessible ? 'list_row_and_json_ld' : 'externally_blocked',
      detailBlocker: 'altcha_pow_challenge',
      capabilityProfile: {
        listDiscovery: listAccessible,
        detailExtraction: false,
        priceFromList: strategy.listPageAccessible,
        availabilityFromList: listAccessible,
        phasesFromDetail: false,
      },
      reliabilityProfile: strategy,
      activationRisk: shopEvents.length > 0 ? 'medium_unregistered_host_with_published_events' : 'low_pre_activation',
      sourceActivation: false,
    });
  }

  writeJson('_phase4741_unregistered_shop_profiles.json', {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    profiles,
  });
  console.log(`Unregistered shop profiles: ${profiles.length}`);
}

async function runVerifyPresentation(): Promise<void> {
  const records = baselineCache.length > 0 ? baselineCache : await buildBaseline();
  const issues = records
    .map((row) => {
      const problems: string[] = [];
      if (row.viewModel.providerLabel !== 'Ticket.io') {
        problems.push(`provider_label:${row.viewModel.providerLabel}`);
      }
      if (!row.purchaseUrl.includes('.ticket.io')) {
        problems.push('missing_ticket_io_destination');
      }
      return { eventId: row.eventId, title: row.title, problems };
    })
    .filter((row) => row.problems.length > 0);

  console.log(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      ticketIoEvents: records.length,
      presentationIssues: issues.length,
      issues,
    }),
  );
}

async function runAcceptance(): Promise<void> {
  const records = baselineCache.length > 0 ? baselineCache : await buildBaseline();
  const counts = records.reduce<Record<string, number>>((acc, row) => {
    acc[row.acceptanceState] = (acc[row.acceptanceState] ?? 0) + 1;
    return acc;
  }, {});

  writeJson('_phase4741_acceptance_matrix.json', {
    generatedAt: new Date().toISOString(),
    totalEvents: records.length,
    acceptanceStates: counts,
    events: records.map((row) => ({
      eventId: row.eventId,
      title: row.title,
      shopHost: row.shopHost,
      acceptanceState: row.acceptanceState,
      failureClass: row.failureClass,
      hasCanonicalPrice: Boolean(row.canonical.priceText?.trim()),
      hasUiPrice: Boolean(row.viewModel.displayPriceText),
      availability: row.canonical.availability,
    })),
  });
  console.log(JSON.stringify(counts, null, 2));
}

function writeReport(): void {
  const baselinePath = join(OUT, '_phase4741_ticketio_baseline.json');
  const baseline = existsSync(baselinePath)
    ? (JSON.parse(readFileSync(baselinePath, 'utf8')) as {
        summary?: Record<string, unknown>;
        publishedTicketIoEvents?: number;
      })
    : {};

  const lines = [
    '# Phase 4.7.4.1 — Ticket.io Completion Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Published Ticket.io events: **${baseline.publishedTicketIoEvents ?? 'n/a'}**`,
    `- With public price evidence: **${baseline.summary?.withPublicPriceEvidence ?? 'n/a'}**`,
    `- With canonical/UI price: **${baseline.summary?.withCanonicalUiPrice ?? 'n/a'}**`,
    '',
    '## Gates',
    '',
    '- Gate C2 BC173: `repair-bc173` (explicit approval)',
    '- Price backfill: `preview-prices` (read-only)',
    '- Availability: `preview-availability` (read-only)',
    '- Sold-out: `preview-soldout` (read-only)',
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase4741_ticketio_baseline.json`',
    '- `docs/real-data/_phase4741_bc173_repair.json`',
    '- `docs/real-data/_phase4741_price_backfill_preview.json`',
    '- `docs/real-data/_phase4741_availability_preview.json`',
    '- `docs/real-data/_phase4741_soldout_preview.json`',
    '- `docs/real-data/_phase4741_shop_root_matrix.json`',
    '- `docs/real-data/_phase4741_unregistered_shop_profiles.json`',
    '- `docs/real-data/_phase4741_acceptance_matrix.json`',
  ];
  writeFileSync(REPORT, lines.join('\n'), 'utf8');
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'full';

  switch (command) {
    case 'baseline':
      await runBaseline();
      break;
    case 'repair-bc173':
      await runRepairBc173();
      break;
    case 'preview-prices':
      if (baselineCache.length === 0) await runBaseline();
      await runPreviewPrices();
      break;
    case 'preview-availability':
      if (baselineCache.length === 0) await runBaseline();
      await runPreviewAvailability();
      break;
    case 'preview-soldout':
      if (baselineCache.length === 0) await runBaseline();
      await runPreviewSoldout();
      break;
    case 'audit-shop-roots':
      if (baselineCache.length === 0) await runBaseline();
      await runAuditShopRoots();
      break;
    case 'profile-unregistered-shops':
      if (baselineCache.length === 0) await runBaseline();
      await runProfileUnregisteredShops();
      break;
    case 'verify-presentation':
      if (baselineCache.length === 0) await runBaseline();
      await runVerifyPresentation();
      break;
    case 'acceptance':
      if (baselineCache.length === 0) await runBaseline();
      await runAcceptance();
      break;
    case 'report':
      writeReport();
      break;
    case 'full':
      await runBaseline();
      await runPreviewPrices();
      await runPreviewAvailability();
      await runPreviewSoldout();
      await runAuditShopRoots();
      await runProfileUnregisteredShops();
      await runVerifyPresentation();
      await runAcceptance();
      writeReport();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
