import { extractTicketIoEventSlug, extractTicketIoShopSlug } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { classifyTicketUrl } from '@/features/events/domain/ticket-url-quality';

export type OutboundTicketLinkClass =
  | 'ticket_io_event'
  | 'ticket_kings_event'
  | 'ticket_shop_root'
  | 'generic_listing'
  | 'unrelated';

export interface ClassifiedOutboundTicketLink {
  url: string;
  class: OutboundTicketLinkClass;
  platform?: 'ticket_io' | 'ticket_king';
  shopSlug?: string;
  eventSlug?: string;
  score: number;
  reason: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;

export function classifyOutboundTicketLink(url: string | { url?: string }): ClassifiedOutboundTicketLink {
  const normalized = (typeof url === 'string' ? url : url.url ?? '').trim();
  if (!normalized) {
    return {
      url: '',
      class: 'unrelated',
      score: 0,
      reason: 'empty_url',
    };
  }
  const ticketIoSlug = extractTicketIoEventSlug(normalized);
  const shopSlug = extractTicketIoShopSlug(normalized);

  if (ticketIoSlug && shopSlug) {
    return {
      url: normalized,
      class: 'ticket_io_event',
      platform: 'ticket_io',
      shopSlug,
      eventSlug: ticketIoSlug,
      score: 95,
      reason: 'ticket_io_event_slug',
    };
  }

  if (shopSlug && /\.ticket\.io\/?$/i.test(normalized.replace(/\?.*$/, ''))) {
    return {
      url: normalized,
      class: 'ticket_shop_root',
      platform: 'ticket_io',
      shopSlug,
      score: 30,
      reason: 'ticket_io_shop_root',
    };
  }

  if (/ticketkings\.de\/event\//i.test(normalized)) {
    return {
      url: normalized,
      class: 'ticket_kings_event',
      platform: 'ticket_king',
      score: 95,
      reason: 'ticket_kings_event_path',
    };
  }

  const classified = classifyTicketUrl(normalized);
  if (classified.class === 'event_specific' || classified.class === 'event_info_page') {
    return {
      url: normalized,
      class: /ticketkings/i.test(normalized) ? 'ticket_kings_event' : 'ticket_io_event',
      platform: /ticketkings/i.test(normalized) ? 'ticket_king' : 'ticket_io',
      score: classified.score,
      reason: classified.reason,
    };
  }

  if (classified.class === 'shop_root' || classified.class === 'platform_root') {
    return {
      url: normalized,
      class: 'ticket_shop_root',
      score: classified.score,
      reason: classified.reason,
    };
  }

  if (/eventim|reservix|rausgegangen|ra\.co/i.test(normalized)) {
    return {
      url: normalized,
      class: 'generic_listing',
      score: 40,
      reason: 'third_party_listing',
    };
  }

  return {
    url: normalized,
    class: 'unrelated',
    score: 0,
    reason: 'not_ticket_destination',
  };
}

export function extractOutboundTicketLinksFromText(text: string | undefined): ClassifiedOutboundTicketLink[] {
  if (!text?.trim()) {
    return [];
  }
  const urls = [...new Set((text.match(URL_PATTERN) ?? []).map((u) => u.replace(/[.,;]+$/, '')))];
  return urls
    .map(classifyOutboundTicketLink)
    .filter((entry) => entry.class !== 'unrelated')
    .sort((a, b) => b.score - a.score);
}

export function pickBestOutboundTicketLink(
  links: ClassifiedOutboundTicketLink[],
): ClassifiedOutboundTicketLink | undefined {
  const eventLinks = links.filter(
    (l) => l.class === 'ticket_io_event' || l.class === 'ticket_kings_event',
  );
  if (eventLinks.length > 0) {
    return eventLinks.sort((a, b) => b.score - a.score)[0];
  }
  const nonShop = links.filter((l) => l.class !== 'ticket_shop_root' && l.class !== 'unrelated');
  if (nonShop.length > 0) {
    return nonShop.sort((a, b) => b.score - a.score)[0];
  }
  return undefined;
}
