import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';
import {
  buildDetailSnapshot,
} from '@/features/aggregation/domain/detail-snapshot';

import { filterElectronicMusicEvents } from '../electronic-music-scope-filter';
import { buildCanonicalTicketUrl } from '../normalize-ticket-event';
import { formatGermanTicketPrice } from '../format-ticket-price';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '../ticket-kings-public-checkout';
import {
  parseTicketKingsDetailHtml,
  TICKET_KINGS_DETAIL_PARSER_VERSION,
} from '../ticket-kings-detail-parser';
import type {
  ParsedTicketPlatformEvent,
  TicketPlatformScopeStats,
  TicketPlatformSourceConfig,
} from '../types';

export interface TicketKingsParseResult {
  events: ParsedTicketPlatformEvent[];
  scopeStats: TicketPlatformScopeStats;
}

const NIGHT_MANAGER_ID_PATTERN = /native_event\.php\?id=(\d+)/i;
const LIST_EVENT_URL_PATTERN =
  /<a[^>]+class="ect-event-url"[^>]+href="(https:\/\/ticketkings\.de\/event\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;

function resolveTicketKingsBaseUrl(config: TicketPlatformSourceConfig): string {
  if (config.listUrl) {
    const url = new URL(config.listUrl);
    return `${url.protocol}//${url.host}`;
  }
  return 'https://ticketkings.de';
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#038;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOfferPrice(offers: unknown): { priceAmount?: number; priceCurrency?: string } {
  if (!offers || typeof offers !== 'object') {
    return {};
  }
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer || typeof offer !== 'object') {
    return {};
  }
  const record = offer as Record<string, unknown>;
  const lowPrice = record.lowPrice ?? record.price;
  return {
    priceAmount: lowPrice !== undefined ? Number(lowPrice) : undefined,
    priceCurrency: record.priceCurrency ? String(record.priceCurrency) : undefined,
  };
}

function extractCheckoutProviderId(html: string, eventUrl: string): string | undefined {
  const slug = eventUrl.replace(/\/$/, '').split('/').pop() ?? '';
  const slugPattern = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scoped = slug
    ? html.match(new RegExp(`native_event\\.php\\?id=(\\d+)[^"']*${slugPattern}`, 'i'))
    : null;
  if (scoped?.[1]) {
    return scoped[1];
  }
  const match = html.match(NIGHT_MANAGER_ID_PATTERN);
  return match?.[1];
}

function mergeTicketKingsCheckoutEvidence(
  event: ParsedTicketPlatformEvent,
  detailHtml?: string,
  checkoutHtml?: string,
): ParsedTicketPlatformEvent {
  const checkoutEvidence = checkoutHtml
    ? parseTicketKingsCheckoutHtml(checkoutHtml)
    : detailHtml
      ? parseTicketKingsCheckoutHtml(detailHtml)
      : undefined;

  if (!checkoutEvidence) {
    if (event.priceAmount !== undefined && !event.priceText) {
      event.priceText = formatGermanTicketPrice(event.priceAmount, event.priceCurrency ?? 'EUR');
    }
    return event;
  }

  const priceAmount = checkoutEvidence.priceAmount ?? event.priceAmount;
  const priceText =
    checkoutEvidence.priceText ??
    (priceAmount !== undefined
      ? formatGermanTicketPrice(priceAmount, checkoutEvidence.priceCurrency ?? event.priceCurrency ?? 'EUR')
      : event.priceText);

  const ticketOffers =
    checkoutEvidence.releases.length > 0
      ? checkoutEvidence.releases.map((release, index) => ({
          name: release.name,
          priceAmount: release.priceAmount,
          priceCurrency: release.priceCurrency ?? 'EUR',
          priceText: release.priceText,
          soldOut: release.soldOut,
          sortOrder: index,
        }))
      : event.ticketOffers;

  return {
    ...event,
    priceAmount,
    priceCurrency: checkoutEvidence.priceCurrency ?? event.priceCurrency,
    priceText,
    soldOut: checkoutEvidence.soldOut ?? event.soldOut,
    ticketOffers,
  };
}

function mergeGenreNames(...groups: Array<string[] | undefined>): string[] | undefined {
  const merged = groups
    .flatMap((group) => group ?? [])
    .map((genre) => genre.trim())
    .filter(Boolean);
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

function mapJsonLdToTicketKingsEvent(
  node: Record<string, unknown>,
  config: TicketPlatformSourceConfig,
  baseUrl: string,
  detailHtml?: string,
): ParsedTicketPlatformEvent | null {
  const parsed = parseJsonLdEvent(node, baseUrl);
  const fields = parsed.fields;
  const title = fields.title ? String(fields.title).trim() : '';
  const startDate = fields.startDate ? String(fields.startDate) : '';
  if (!title || !startDate) {
    return null;
  }

  const eventUrl = buildCanonicalTicketUrl(
    baseUrl,
    String(fields.eventUrl ?? parsed.externalId),
  );
  const offer = parseOfferPrice((node as Record<string, unknown>).offers);

  const detailRaw = detailHtml ? parseTicketKingsDetailHtml(detailHtml) : undefined;

  const jsonLdArtists = sanitizeLineupArtistNames(
    Array.isArray(fields.artistNames)
      ? fields.artistNames.map(String).filter(Boolean)
      : undefined,
  );

  const detailArtists = sanitizeLineupArtistNames(detailRaw?.artistNames);

  const artistNames =
    detailArtists && detailArtists.length > 0
      ? detailArtists
      : jsonLdArtists;

  const genreNames = mergeGenreNames(
    Array.isArray(fields.genreNames)
      ? fields.genreNames.map(String).filter(Boolean)
      : undefined,
    detailRaw?.genreNames,
  );

  const checkoutProviderId =
    detailRaw?.checkoutProviderId ??
    extractCheckoutProviderId(detailHtml ?? '', eventUrl);

  const priceAmount =
    offer.priceAmount ?? detailRaw?.priceAmount;
  const priceCurrency =
    detailRaw?.priceCurrency ?? offer.priceCurrency ?? 'EUR';
  const priceText =
    priceAmount !== undefined ? formatGermanTicketPrice(priceAmount, priceCurrency) : undefined;

  return mergeTicketKingsCheckoutEvidence(
    {
    externalId: eventUrl,
    title,
    description:
      detailRaw?.description ??
      stripHtml(fields.description ? String(fields.description) : undefined),
    startDate,
    endDate: fields.endDate ? String(fields.endDate) : undefined,
    timezone: config.timezone ?? 'Europe/Berlin',
    venueName: fields.venueName ? String(fields.venueName).replace(/^:\s*/, '') : undefined,
    venueAddress: fields.venueAddress ? String(fields.venueAddress) : undefined,
    cityName: fields.cityName ? String(fields.cityName) : undefined,
    countryCode: 'DE',
    latitude: fields.latitude !== undefined ? Number(fields.latitude) : undefined,
    longitude: fields.longitude !== undefined ? Number(fields.longitude) : undefined,
    organizerName: fields.organizerName ? String(fields.organizerName) : undefined,
    artistNames,
    genreNames,
    imageUrl: fields.imageUrl ? String(fields.imageUrl) : undefined,
    ticketUrl: eventUrl,
    eventUrl,
    priceAmount,
    priceCurrency,
    priceText,
    platform: 'ticket_king',
    shopSlug: config.shopSlug,
    checkoutProviderId,
    lineupEntries: detailRaw?.lineupEntries,
    minimumAge: detailRaw?.minimumAge,
    doorsOpenAt: detailRaw?.doorsOpenAt,
    floorCount: detailRaw?.floorCount,
    venueEnvironment: detailRaw?.venueEnvironment,
    eventAttributes: detailRaw?.eventAttributes,
    },
    detailHtml,
  );
}

function parseListEventsFromHtml(
  html: string,
  config: TicketPlatformSourceConfig,
  baseUrl: string,
): ParsedTicketPlatformEvent[] {
  const events: ParsedTicketPlatformEvent[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(LIST_EVENT_URL_PATTERN.source, 'gi');

  while ((match = pattern.exec(html)) !== null) {
    const eventUrl = buildCanonicalTicketUrl(baseUrl, match[1] ?? '');
    const title = stripHtml(match[2]);
    if (!title || seen.has(eventUrl)) {
      continue;
    }
    seen.add(eventUrl);
    events.push({
      externalId: eventUrl,
      title,
      startDate: '',
      timezone: config.timezone ?? 'Europe/Berlin',
      ticketUrl: eventUrl,
      eventUrl,
      platform: 'ticket_king',
      shopSlug: config.shopSlug,
    });
  }

  return events;
}

export function parseTicketKingsEventDetailHtml(
  html: string,
  config: TicketPlatformSourceConfig,
): ParsedTicketPlatformEvent | null {
  const baseUrl = resolveTicketKingsBaseUrl(config);

  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const event = mapJsonLdToTicketKingsEvent(node, config, baseUrl, html);
      if (event) {
        return event;
      }
    }
  }

  return null;
}

export function parseTicketKingsShopHtml(
  html: string,
  config: TicketPlatformSourceConfig,
  detailHtmlByUrl: Record<string, string> = {},
  checkoutHtmlByUrl: Record<string, string> = {},
): TicketKingsParseResult {
  const baseUrl = resolveTicketKingsBaseUrl(config);
  const discovered = new Map<string, ParsedTicketPlatformEvent>();

  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const provisionalUrl = buildCanonicalTicketUrl(
        baseUrl,
        String((node as Record<string, unknown>).url ?? ''),
      );
      const detailHtml = detailHtmlByUrl[provisionalUrl];
      const checkoutHtml = checkoutHtmlByUrl[provisionalUrl];
      const event = mapJsonLdToTicketKingsEvent(node, config, baseUrl, detailHtml);
      if (!event) {
        continue;
      }
      discovered.set(
        event.externalId,
        mergeTicketKingsCheckoutEvidence(event, detailHtml, checkoutHtml),
      );
    }
  }

  for (const fallback of parseListEventsFromHtml(html, config, baseUrl)) {
    const existing = discovered.get(fallback.externalId);
    if (existing) {
      if (!existing.startDate && fallback.title) {
        existing.title = existing.title || fallback.title;
      }
      continue;
    }
    discovered.set(fallback.externalId, fallback);
  }

  const maxEvents = config.limits?.maxEventsPerRun ?? 100;
  const limited = [...discovered.values()]
    .filter((event) => event.startDate)
    .slice(0, maxEvents);
  const { events, stats } = filterElectronicMusicEvents(limited, config.scope);

  return { events, scopeStats: stats };
}

export function buildTicketKingsDetailSnapshot(
  eventUrl: string,
  detailHtml?: string,
  blocked?: boolean,
): ReturnType<typeof buildDetailSnapshot> {
  if (!detailHtml || blocked) {
    return buildDetailSnapshot({
      externalEventId: eventUrl,
      url: eventUrl,
      parserVersion: TICKET_KINGS_DETAIL_PARSER_VERSION,
      httpOutcome: blocked ? 'blocked' : 'failed',
      blockedReason: blocked ? 'detail_fetch_blocked' : 'detail_fetch_failed',
    });
  }

  const parsed = parseTicketKingsDetailHtml(detailHtml);
  return buildDetailSnapshot({
    externalEventId: eventUrl,
    url: eventUrl,
    parserVersion: TICKET_KINGS_DETAIL_PARSER_VERSION,
    httpOutcome: 'success',
    fieldCoverage: parsed.fieldCoverage,
    normalizedPayload: {
      description: parsed.description,
      artistNames: parsed.artistNames,
      lineupEntries: parsed.lineupEntries,
      genreNames: parsed.genreNames,
      eventAttributes: parsed.eventAttributes,
      floorCount: parsed.floorCount,
      minimumAge: parsed.minimumAge,
      doorsOpenAt: parsed.doorsOpenAt,
      priceAmount: parsed.priceAmount,
    },
  });
}
