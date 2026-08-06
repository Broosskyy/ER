import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';

import { filterElectronicMusicEvents } from '../electronic-music-scope-filter';
import { formatGermanTicketPrice } from '../format-ticket-price';
import { parseTicketIoDetailHtml } from '../ticket-io-detail-parser';
import {
  sanitizeTicketIoArtistNames,
  sanitizeTicketIoDescription,
} from '../ticket-io-field-quality';
import {
  extractTicketIoEventSlugFromUrl,
  parseAllTicketIoListRowContexts,
  type TicketIoListRowContext,
} from '../ticket-io-list-enrichment';
import { extractArtistsFromEventTitle } from '../ticket-io-title-artists';
import {
  extractTicketIoEventSlug,
  normalizeTicketIoEventUrl,
  validateTicketIoEventUrl,
} from '../ticket-io-url';
import {
  buildCanonicalTicketUrl,
  resolveTicketShopBaseUrl,
} from '../normalize-ticket-event';
import type {
  ParsedTicketPlatformEvent,
  TicketPlatformScopeStats,
  TicketPlatformSourceConfig,
} from '../types';

export interface TicketIoListResult {
  events: ParsedTicketPlatformEvent[];
  scopeStats: TicketPlatformScopeStats;
}

function parseOfferDetails(offers: unknown): {
  priceAmount?: number;
  priceCurrency?: string;
  ticketUrl?: string;
  availability?: string;
  soldOut?: boolean;
} {
  if (!offers || typeof offers !== 'object') {
    return {};
  }
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer || typeof offer !== 'object') {
    return {};
  }
  const record = offer as Record<string, unknown>;
  const availability = record.availability ? String(record.availability) : undefined;
  const availabilityToken = availability ? availability.split('/').pop()?.toLowerCase() : undefined;
  return {
    priceAmount: record.price !== undefined ? Number(record.price) : undefined,
    priceCurrency: record.priceCurrency ? String(record.priceCurrency) : undefined,
    ticketUrl: record.url ? String(record.url) : undefined,
    availability: availabilityToken,
    soldOut: availabilityToken === 'soldout' || availabilityToken === 'outofstock',
  };
}

function parseEventCancelled(node: Record<string, unknown>): boolean {
  const status = node.eventStatus ? String(node.eventStatus) : '';
  return /cancelled|canceled/i.test(status);
}

function mergeGenreNames(
  jsonLdGenres: string[] | undefined,
  listGenres: string[] | undefined,
): string[] | undefined {
  const merged = [...(jsonLdGenres ?? []), ...(listGenres ?? [])]
    .map((genre) => genre.trim())
    .filter(Boolean);
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

function mapJsonLdToTicketEvent(
  node: Record<string, unknown>,
  config: TicketPlatformSourceConfig,
  baseUrl: string,
  listContext?: TicketIoListRowContext,
  detailEnrichment?: ReturnType<typeof parseTicketIoDetailHtml>,
): ParsedTicketPlatformEvent | null {
  const parsed = parseJsonLdEvent(node, baseUrl);
  const fields = parsed.fields;
  const title = fields.title ? String(fields.title).trim() : '';
  const startDate = fields.startDate ? String(fields.startDate) : '';
  if (!title || !startDate) {
    return null;
  }

  const offer = parseOfferDetails((node as Record<string, unknown>).offers);
  const rawTicketTarget = offer.ticketUrl ?? String(fields.ticketUrl ?? fields.eventUrl ?? parsed.externalId);
  const ticketUrl = normalizeTicketIoEventUrl(
    buildCanonicalTicketUrl(baseUrl, rawTicketTarget),
  );
  const eventSlug =
    listContext?.eventSlug ??
    extractTicketIoEventSlug(ticketUrl) ??
    extractTicketIoEventSlugFromUrl(ticketUrl);

  const urlValidation = validateTicketIoEventUrl({
    ticketUrl,
    shopSlug: config.shopSlug,
    title,
    eventSlug,
  });
  if (!urlValidation.valid) {
    return null;
  }

  const jsonLdArtists = sanitizeTicketIoArtistNames(
    Array.isArray(fields.artistNames)
      ? fields.artistNames.map(String).filter(Boolean)
      : undefined,
  );
  const titleArtists = extractArtistsFromEventTitle(title);
  const detailArtists = detailEnrichment?.artistNames;
  const structuredArtists = sanitizeTicketIoArtistNames([
    ...(jsonLdArtists ?? []),
    ...(detailArtists ?? []),
  ]);
  const artistNames =
    structuredArtists && structuredArtists.length > 0
      ? structuredArtists
      : sanitizeTicketIoArtistNames(titleArtists);

  const genreNames = mergeGenreNames(
    Array.isArray(fields.genreNames)
      ? fields.genreNames.map(String).filter(Boolean)
      : undefined,
    listContext?.genreNames,
  );

  const priceAmount = detailEnrichment?.priceAmount ?? offer.priceAmount;
  const priceCurrency = detailEnrichment?.priceCurrency ?? offer.priceCurrency ?? 'EUR';
  const soldOut =
    detailEnrichment?.soldOut ?? listContext?.soldOut ?? offer.soldOut ?? false;
  const priceText =
    detailEnrichment?.priceText ??
    listContext?.priceText ??
    (soldOut ? 'Ausverkauft' : formatGermanTicketPrice(priceAmount, priceCurrency));

  const description =
    detailEnrichment?.description ??
    sanitizeTicketIoDescription(fields.description ? String(fields.description) : undefined);

  return {
    externalId: ticketUrl,
    title,
    description,
    startDate,
    endDate: fields.endDate ? String(fields.endDate) : undefined,
    timezone: config.timezone ?? 'Europe/Berlin',
    venueName: fields.venueName ? String(fields.venueName) : undefined,
    venueAddress: fields.venueAddress ? String(fields.venueAddress) : undefined,
    cityName: fields.cityName ? String(fields.cityName) : undefined,
    countryCode: 'DE',
    latitude: fields.latitude !== undefined ? Number(fields.latitude) : undefined,
    longitude: fields.longitude !== undefined ? Number(fields.longitude) : undefined,
    organizerName: fields.organizerName ? String(fields.organizerName) : undefined,
    artistNames,
    genreNames,
    imageUrl: fields.imageUrl ? String(fields.imageUrl) : undefined,
    ticketUrl,
    eventUrl: ticketUrl,
    priceAmount,
    priceCurrency,
    priceText,
    availability: detailEnrichment?.availability ?? offer.availability,
    soldOut,
    cancelled: parseEventCancelled(node),
    eventSlug,
    lineupEntries: detailEnrichment?.lineupEntries,
    ticketOffers: detailEnrichment?.ticketOffers,
    platform: 'ticket_io',
    shopSlug: config.shopSlug,
  };
}

export function parseTicketIoShopHtml(
  html: string,
  config: TicketPlatformSourceConfig,
  detailHtmlBySlug: Record<string, string> = {},
): TicketIoListResult {
  const baseUrl = config.listUrl ?? resolveTicketShopBaseUrl(config.shopSlug);
  const listContexts = parseAllTicketIoListRowContexts(html);
  const discovered: ParsedTicketPlatformEvent[] = [];
  const seen = new Set<string>();

  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const offer = parseOfferDetails((node as Record<string, unknown>).offers);
      const provisionalUrl = normalizeTicketIoEventUrl(
        buildCanonicalTicketUrl(
          baseUrl,
          offer.ticketUrl ?? String((node as Record<string, unknown>).url ?? ''),
        ),
      );
      const eventSlug = extractTicketIoEventSlug(provisionalUrl);
      const listContext = eventSlug ? listContexts.get(eventSlug) : undefined;
      const detailHtml = eventSlug ? detailHtmlBySlug[eventSlug] : undefined;
      const detailEnrichment = detailHtml
        ? parseTicketIoDetailHtml(detailHtml, String((node as Record<string, unknown>).name ?? ''))
        : undefined;
      const effectiveDetail = detailEnrichment?.blockedByPow ? undefined : detailEnrichment;

      const event = mapJsonLdToTicketEvent(
        node,
        config,
        baseUrl,
        listContext,
        effectiveDetail,
      );
      if (!event || seen.has(event.externalId)) {
        continue;
      }
      seen.add(event.externalId);
      discovered.push(event);
    }
  }

  const maxEvents = config.limits?.maxEventsPerRun ?? 100;
  const limited = discovered.slice(0, maxEvents);
  const { events, stats } = filterElectronicMusicEvents(limited, config.scope);

  return { events, scopeStats: stats };
}

export function parseTicketIoEventDetailHtml(
  html: string,
  config: TicketPlatformSourceConfig,
  fallbackTitle?: string,
): ParsedTicketPlatformEvent | null {
  const baseUrl = config.listUrl ?? resolveTicketShopBaseUrl(config.shopSlug);
  const detail = parseTicketIoDetailHtml(html, fallbackTitle);
  if (detail.blockedByPow) {
    return null;
  }

  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      return mapJsonLdToTicketEvent(node, config, baseUrl, undefined, detail);
    }
  }

  return null;
}
