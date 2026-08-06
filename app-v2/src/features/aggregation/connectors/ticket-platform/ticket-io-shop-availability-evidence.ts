import {
  discoverTicketIoPriceEvidence,
  type TicketIoPriceEvidenceDiscovery,
} from './ticket-io-price-evidence';
import {
  extractTicketIoEventSlugFromUrl,
  parseAllTicketIoListRowContexts,
} from './ticket-io-list-enrichment';
import { extractTicketIoShopSlug, isTicketIoShopRootUrl } from './ticket-io-url';

export type TicketIoAvailabilityIdentityStrength =
  | 'event_slug_in_url'
  | 'event_specific_url'
  | 'list_row_slug'
  | 'title_and_date_in_list'
  | 'title_venue_date_in_list';

export interface TicketIoShopAvailabilityAudit {
  eventId: string;
  title: string;
  ticketUrl: string;
  shopSlug: string | null;
  eventSlug: string | null;
  eventSpecific: boolean;
  strongIdentitySignals: TicketIoAvailabilityIdentityStrength[];
  supportingEvidence: string[];
  shopLevelSignals: string[];
  rejectionReason?: 'shop_level_signal_not_event_specific';
  reviewRequired: boolean;
  inferredAvailability?: string;
  evidenceSurfaces: string[];
}

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractArtistToken(title: string): string | undefined {
  const match = title.match(/122\s+pres\.\s+([^@]+)/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return undefined;
  }
  return normalizeMatchText(token);
}

function extractEventDateToken(title: string, startAt?: string): string | undefined {
  if (startAt) {
    const parsed = new Date(startAt);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
    }
  }
  const inline = title.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!inline) {
    return undefined;
  }
  const yearRaw = inline[3];
  const monthRaw = inline[2];
  const dayRaw = inline[1];
  if (!yearRaw || !monthRaw || !dayRaw) {
    return undefined;
  }
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${year}-${monthRaw.padStart(2, '0')}-${dayRaw.padStart(2, '0')}`;
}

function findListRowSlugForEvent(
  listHtml: string,
  title: string,
  venueName?: string,
  startAt?: string,
): { slug?: string; signal?: TicketIoAvailabilityIdentityStrength } {
  const rows = parseAllTicketIoListRowContexts(listHtml);
  const artistToken = extractArtistToken(title);
  const dateToken = extractEventDateToken(title, startAt);
  const venueToken = venueName ? normalizeMatchText(venueName) : undefined;
  const normalizedHtml = normalizeMatchText(listHtml);

  for (const [slug] of rows) {
    const slugIndex = listHtml.indexOf(slug);
    if (slugIndex < 0) {
      continue;
    }
    const windowStart = Math.max(0, slugIndex - 1200);
    const windowEnd = Math.min(listHtml.length, slugIndex + 1200);
    const rowWindow = normalizeMatchText(listHtml.slice(windowStart, windowEnd));

    if (artistToken && rowWindow.includes(artistToken)) {
      if (dateToken && rowWindow.includes(dateToken.replace(/-/g, ' ').slice(0, 7))) {
        return { slug, signal: 'title_and_date_in_list' };
      }
      if (venueToken && rowWindow.includes(venueToken) && dateToken) {
        return { slug, signal: 'title_venue_date_in_list' };
      }
      return { slug, signal: 'list_row_slug' };
    }
  }

  if (artistToken && normalizedHtml.includes(artistToken)) {
    return { signal: 'title_and_date_in_list' };
  }

  return {};
}

export function auditTicketIoShopAvailabilityEvidence(input: {
  eventId: string;
  title: string;
  ticketUrl: string;
  listHtml: string;
  venueName?: string;
  startAt?: string;
  discovery?: TicketIoPriceEvidenceDiscovery;
}): TicketIoShopAvailabilityAudit {
  const ticketUrl = input.ticketUrl.trim();
  const shopSlug = extractTicketIoShopSlug(ticketUrl);
  const eventSlug = extractTicketIoEventSlugFromUrl(ticketUrl);
  const discovery =
    input.discovery ??
    discoverTicketIoPriceEvidence({
      shopSlug: shopSlug ?? 'unknown',
      listUrl: shopSlug ? `https://${shopSlug}.ticket.io/` : ticketUrl,
      listHtml: input.listHtml,
      eventUrl: ticketUrl,
    });

  const strongIdentitySignals: TicketIoAvailabilityIdentityStrength[] = [];
  const supportingEvidence: string[] = [];
  const shopLevelSignals: string[] = [];
  const evidenceSurfaces: string[] = [];

  if (eventSlug) {
    strongIdentitySignals.push('event_slug_in_url');
    supportingEvidence.push(`event_slug:${eventSlug}`);
  }

  if (eventSlug && input.listHtml.includes(eventSlug)) {
    strongIdentitySignals.push('list_row_slug');
    supportingEvidence.push(`list_contains_slug:${eventSlug}`);
  }

  if (!eventSlug && isTicketIoShopRootUrl(ticketUrl)) {
    const listMatch = findListRowSlugForEvent(
      input.listHtml,
      input.title,
      input.venueName,
      input.startAt,
    );
    if (listMatch.slug && listMatch.signal) {
      strongIdentitySignals.push(listMatch.signal);
      supportingEvidence.push(`matched_list_row:${listMatch.slug}`);
    }
  }

  if (discovery.listJsonLdOfferCount > 0) {
    shopLevelSignals.push('shop_wide_json_ld_offer');
    evidenceSurfaces.push('list_json_ld');
  } else if (/"@type"\s*:\s*"Offer"/i.test(input.listHtml) && /InStock|OutOfStock|SoldOut/i.test(input.listHtml)) {
    shopLevelSignals.push('shop_wide_json_ld_offer');
    evidenceSurfaces.push('list_json_ld');
  }
  if (discovery.bestHit?.surface) {
    evidenceSurfaces.push(discovery.bestHit.surface);
  }
  for (const hit of discovery.hits) {
    if (hit.surface) {
      evidenceSurfaces.push(hit.surface);
    }
  }

  const eventSpecific = strongIdentitySignals.length > 0;
  const reviewRequired = !eventSpecific;

  let inferredAvailability: string | undefined;
  if (discovery.bestHit?.soldOut) {
    inferredAvailability = 'sold_out';
  } else if (discovery.listJsonLdOfferCount > 0 && discovery.bestHit?.priceText) {
    inferredAvailability = 'available';
  }

  return {
    eventId: input.eventId,
    title: input.title,
    ticketUrl,
    shopSlug,
    eventSlug: eventSlug ?? null,
    eventSpecific,
    strongIdentitySignals,
    supportingEvidence,
    shopLevelSignals,
    rejectionReason: eventSpecific ? undefined : 'shop_level_signal_not_event_specific',
    reviewRequired,
    inferredAvailability,
    evidenceSurfaces: [...new Set(evidenceSurfaces)],
  };
}
