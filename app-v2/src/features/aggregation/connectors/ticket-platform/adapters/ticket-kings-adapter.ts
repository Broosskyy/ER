import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';

import { filterElectronicMusicEvents } from '../electronic-music-scope-filter';
import { buildCanonicalTicketUrl } from '../normalize-ticket-event';
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

function parseDetailMeta(html: string): {
  priceAmount?: number;
  priceCurrency?: string;
  checkoutProviderId?: string;
} {
  const priceMatch = html.match(/Eintritt:\s*([\d.,]+)\s*€/i);
  const priceAmount = priceMatch?.[1]
    ? Number(priceMatch[1].replace(',', '.'))
    : undefined;

  return {
    priceAmount: Number.isFinite(priceAmount) ? priceAmount : undefined,
    priceCurrency: priceMatch ? 'EUR' : undefined,
    checkoutProviderId: extractCheckoutProviderId(html, ''),
  };
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
  const detailMeta = detailHtml ? parseDetailMeta(detailHtml) : {};
  const checkoutProviderId =
    detailMeta.checkoutProviderId ?? extractCheckoutProviderId(detailHtml ?? '', eventUrl);

  return {
    externalId: eventUrl,
    title,
    description: stripHtml(fields.description ? String(fields.description) : undefined),
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
    artistNames: Array.isArray(fields.artistNames)
      ? fields.artistNames.map(String).filter(Boolean)
      : undefined,
    imageUrl: fields.imageUrl ? String(fields.imageUrl) : undefined,
    ticketUrl: eventUrl,
    eventUrl,
    priceAmount: offer.priceAmount ?? detailMeta.priceAmount,
    priceCurrency: offer.priceCurrency ?? detailMeta.priceCurrency ?? 'EUR',
    platform: 'ticket_king',
    shopSlug: config.shopSlug,
    checkoutProviderId,
  };
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
): TicketKingsParseResult {
  const baseUrl = resolveTicketKingsBaseUrl(config);
  const discovered = new Map<string, ParsedTicketPlatformEvent>();

  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const event = mapJsonLdToTicketKingsEvent(node, config, baseUrl);
      if (!event) {
        continue;
      }
      discovered.set(event.externalId, event);
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
