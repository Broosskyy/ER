import {
  extractTicketIoEventSlug,
  extractTicketIoShopSlug,
  isTicketIoUrl,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import {
  classifyPersistedNachtManagerUrl,
  isBrokenTicketKingsCheckoutClass,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-checkout-url-integrity';
import { classifyTicketUrl } from '@/features/events/domain/ticket-url-quality';
import type { TicketDestinationClass } from '@/features/events/domain/canonical-ticket-domain';
import { meaningfulEventText } from '@/features/events/domain/event-field-value';

export interface ClassifiedTicketDestination {
  url: string;
  destinationClass: TicketDestinationClass;
  score: number;
  host?: string;
  reason: string;
  ticketPlatform?: string;
}

const CHECKOUT_PATTERNS = [
  /\/checkout\b/i,
  /\/cart\b/i,
  /\/basket\b/i,
  /\/kasse\b/i,
  /[?&]checkout=/i,
];

const LISTING_PATTERNS = [
  /\/events\/?$/i,
  /\/programm\b/i,
  /\/kalender\b/i,
  /\/tickets\/?$/i,
];

const REDIRECT_HOSTS = new Set(['bit.ly', 't.co', 'goo.gl', 'lnkd.in']);

function detectTicketPlatform(host: string, url: string): string | undefined {
  if (isTicketIoUrl(url) || /\.ticket\.io$/i.test(host)) {
    return 'ticket.io';
  }
  if (/ticketkings\.de/i.test(host)) {
    return 'ticket_kings';
  }
  if (/eventim\./i.test(host)) {
    return 'eventim';
  }
  if (/reservix\./i.test(host)) {
    return 'reservix';
  }
  if (/dice\.fm/i.test(host)) {
    return 'dice';
  }
  if (/shotgun\.live/i.test(host)) {
    return 'shotgun';
  }
  return undefined;
}

export function classifyTicketDestination(url: string | undefined | null): ClassifiedTicketDestination {
  const text = meaningfulEventText(url);
  if (!text) {
    return {
      url: '',
      destinationClass: 'invalid',
      score: 0,
      reason: 'empty_url',
    };
  }

  let parsed: URL | undefined;
  try {
    parsed = new URL(text.startsWith('http') ? text : `https://${text}`);
  } catch {
    return { url: text, destinationClass: 'invalid', score: 0, reason: 'unparseable_url' };
  }

  const host = parsed.hostname.toLowerCase();
  const platform = detectTicketPlatform(host, text);

  if (REDIRECT_HOSTS.has(host)) {
    return {
      url: text,
      destinationClass: 'redirect_or_tracking',
      score: 45,
      host,
      reason: 'short_redirect_host',
      ticketPlatform: platform,
    };
  }

  if (CHECKOUT_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      url: text,
      destinationClass: 'direct_purchase',
      score: 100,
      host,
      reason: 'checkout_route',
      ticketPlatform: platform,
    };
  }

  if (/nacht-manager\.de\/ticketing\/native_event\.php/i.test(text)) {
    const checkoutClass = classifyPersistedNachtManagerUrl(text);
    if (isBrokenTicketKingsCheckoutClass(checkoutClass)) {
      return {
        url: text,
        destinationClass: 'invalid',
        score: 0,
        host,
        reason: checkoutClass,
        ticketPlatform: 'ticket_kings',
      };
    }
    return {
      url: text,
      destinationClass: 'embedded_checkout_evidence',
      score: 82,
      host,
      reason:
        checkoutClass === 'valid_embedded_checkout'
          ? 'nacht_manager_embedded_checkout'
          : 'nacht_manager_event_checkout',
      ticketPlatform: 'ticket_kings',
    };
  }

  const legacy = classifyTicketUrl(text);

  if (legacy.class === 'invalid') {
    return {
      url: text,
      destinationClass: 'invalid',
      score: 0,
      host,
      reason: legacy.reason,
      ticketPlatform: platform,
    };
  }

  if (isTicketIoUrl(text)) {
    const eventSlug = extractTicketIoEventSlug(text);
    if (eventSlug) {
      return {
        url: legacy.normalized ?? text,
        destinationClass: 'ticket_platform_event',
        score: 90,
        host: extractTicketIoShopSlug(text) ?? host,
        reason: 'ticket_io_event_page',
        ticketPlatform: 'ticket.io',
      };
    }
    if (extractTicketIoShopSlug(text)) {
      return {
        url: legacy.normalized ?? text,
        destinationClass: 'ticket_platform_root',
        score: 30,
        host: extractTicketIoShopSlug(text) ?? host,
        reason: 'ticket_io_shop_root',
        ticketPlatform: 'ticket.io',
      };
    }
  }

  if (/ticketkings\.de\/event\//i.test(text)) {
    return {
      url: legacy.normalized ?? text,
      destinationClass: 'ticket_platform_event',
      score: 88,
      host,
      reason: 'ticket_kings_event_page',
      ticketPlatform: 'ticket_kings',
    };
  }

  if (LISTING_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      url: legacy.normalized ?? text,
      destinationClass: 'ticket_platform_listing',
      score: 50,
      host,
      reason: 'platform_listing_page',
      ticketPlatform: platform,
    };
  }

  if (legacy.class === 'event_info_page') {
    return {
      url: legacy.normalized ?? text,
      destinationClass: 'official_event_page',
      score: 70,
      host,
      reason: legacy.reason,
      ticketPlatform: platform,
    };
  }

  if (legacy.class === 'shop_root' || legacy.class === 'platform_root') {
    return {
      url: legacy.normalized ?? text,
      destinationClass: 'ticket_platform_root',
      score: 30,
      host,
      reason: legacy.reason,
      ticketPlatform: platform,
    };
  }

  if (legacy.class === 'event_specific') {
    return {
      url: legacy.normalized ?? text,
      destinationClass: platform ? 'ticket_platform_event' : 'direct_purchase',
      score: platform ? 90 : 95,
      host,
      reason: legacy.reason,
      ticketPlatform: platform,
    };
  }

  const pathDepth = parsed.pathname.split('/').filter(Boolean).length;
  if (pathDepth === 0) {
    return {
      url: legacy.normalized ?? text,
      destinationClass: 'organizer_or_venue_homepage',
      score: 20,
      host,
      reason: 'site_homepage',
      ticketPlatform: platform,
    };
  }

  return {
    url: legacy.normalized ?? text,
    destinationClass: 'unknown',
    score: 5,
    host,
    reason: legacy.reason || 'unclassified',
    ticketPlatform: platform,
  };
}
