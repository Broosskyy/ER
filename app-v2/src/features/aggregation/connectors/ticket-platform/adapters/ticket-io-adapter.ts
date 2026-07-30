import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';

import { filterElectronicMusicEvents } from '../electronic-music-scope-filter';
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

function parseOfferPrice(offers: unknown): { priceAmount?: number; priceCurrency?: string; ticketUrl?: string } {
  if (!offers || typeof offers !== 'object') {
    return {};
  }
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer || typeof offer !== 'object') {
    return {};
  }
  const record = offer as Record<string, unknown>;
  return {
    priceAmount: record.price !== undefined ? Number(record.price) : undefined,
    priceCurrency: record.priceCurrency ? String(record.priceCurrency) : undefined,
    ticketUrl: record.url ? String(record.url) : undefined,
  };
}

function mapJsonLdToTicketEvent(
  node: Record<string, unknown>,
  config: TicketPlatformSourceConfig,
  baseUrl: string,
): ParsedTicketPlatformEvent | null {
  const parsed = parseJsonLdEvent(node, baseUrl);
  const fields = parsed.fields;
  const title = fields.title ? String(fields.title).trim() : '';
  const startDate = fields.startDate ? String(fields.startDate) : '';
  if (!title || !startDate) {
    return null;
  }

  const offer = parseOfferPrice((node as Record<string, unknown>).offers);
  const ticketUrl = buildCanonicalTicketUrl(
    baseUrl,
    offer.ticketUrl ?? String(fields.ticketUrl ?? fields.eventUrl ?? parsed.externalId),
  );

  return {
    externalId: ticketUrl,
    title,
    description: fields.description ? String(fields.description) : undefined,
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
    artistNames: Array.isArray(fields.artistNames)
      ? fields.artistNames.map(String).filter(Boolean)
      : undefined,
    imageUrl: fields.imageUrl ? String(fields.imageUrl) : undefined,
    ticketUrl,
    eventUrl: ticketUrl,
    priceAmount: offer.priceAmount,
    priceCurrency: offer.priceCurrency,
    platform: 'ticket_io',
    shopSlug: config.shopSlug,
  };
}

export function parseTicketIoShopHtml(
  html: string,
  config: TicketPlatformSourceConfig,
): TicketIoListResult {
  const baseUrl = config.listUrl ?? resolveTicketShopBaseUrl(config.shopSlug);
  const discovered: ParsedTicketPlatformEvent[] = [];
  const seen = new Set<string>();

  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const event = mapJsonLdToTicketEvent(node, config, baseUrl);
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
