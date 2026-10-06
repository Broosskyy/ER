import { canonicalizeTicketIoUrl, classifyProviderKey } from '../url-policy';
import { normalizeTicketIoShopUrl } from './shop-seeds';

export type OutboundSourceRole =
  | 'official_organizer'
  | 'official_venue'
  | 'event_website'
  | 'social'
  | 'ticket_provider'
  | 'other_official'
  | 'unknown';

export interface OutboundSourceRef {
  url: string;
  role: OutboundSourceRole;
  providerKey: string;
}

const SOCIAL_HOSTS = /(?:instagram\.com|facebook\.com|fb\.com|tiktok\.com|x\.com|twitter\.com)/i;
const ORGANIZER_HOSTS =
  /(?:bootshaus\.tv|nibirii\.|odonien\.|stadtgarten\.|affenkaefig\.|kitkatclub\.)/i;
const VENUE_HOSTS = /(?:bootshaus\.tv|stadtgarten\.|odonien\.|gewoelbe\.)/i;

export function classifyOutboundUrl(url: string): OutboundSourceRef {
  const providerKey = classifyProviderKey(url);
  let role: OutboundSourceRole = 'unknown';

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (SOCIAL_HOSTS.test(host)) {
      role = 'social';
    } else if (providerKey === 'ticket_io' || providerKey === 'paylogic' || providerKey === 'eventim') {
      role = 'ticket_provider';
    } else if (ORGANIZER_HOSTS.test(host)) {
      role = 'official_organizer';
    } else if (VENUE_HOSTS.test(host)) {
      role = 'official_venue';
    } else if (/event|programm|tour|festival/i.test(url)) {
      role = 'event_website';
    } else if (providerKey === 'organizer_shop') {
      role = 'other_official';
    }
  } catch {
    role = 'unknown';
  }

  return { url, role, providerKey };
}

export function extractTicketIoShopUrlsFromLinks(links: string[]): string[] {
  const shops = new Set<string>();
  for (const link of links) {
    const root =
      normalizeTicketIoShopUrl(link) ??
      (() => {
        try {
          const parsed = new URL(link);
          if (!parsed.hostname.endsWith('.ticket.io')) {
            return null;
          }
          return `https://${parsed.hostname}/`;
        } catch {
          return null;
        }
      })();
    if (root) {
      shops.add(root);
    }
  }
  return [...shops];
}

export function buildOutboundSourceGraph(
  ticketUrl: string,
  outboundLinks: string[],
): {
  ticketIoEvent: string;
  outbound: OutboundSourceRef[];
} {
  const outbound = outboundLinks
    .filter((url) => url !== ticketUrl)
    .map((url) => classifyOutboundUrl(url));
  return { ticketIoEvent: ticketUrl, outbound };
}
