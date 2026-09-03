import { canonicalizeTicketIoUrl, isTicketIoHost, isTicketIoShopRootUrl } from '../url-policy';
import type { TicketIoDiscoveryMethod } from './types';

export interface TicketIoShopSeed {
  slug: string;
  canonicalUrl: string;
  organizerName?: string;
  city?: string;
  region?: string;
  discoveryMethod: TicketIoDiscoveryMethod;
  discoveredFrom: string;
}

/** Initial NRW-focused seed list from M9.3A probes + known electronic venues. */
export const TICKET_IO_SHOP_SEEDS: TicketIoShopSeed[] = [
  {
    slug: 'bootshaus-club',
    canonicalUrl: 'https://bootshaus-club.ticket.io/',
    organizerName: 'BOOTSHAUS',
    city: 'Köln',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3a_probe',
  },
  {
    slug: 'stadtgarten',
    canonicalUrl: 'https://stadtgarten.ticket.io/',
    organizerName: 'Stadtgarten',
    city: 'Köln',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3a_probe',
  },
  {
    slug: 'nibirii-festival',
    canonicalUrl: 'https://nibirii-festival.ticket.io/',
    organizerName: 'NIBIRII',
    city: 'Köln',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3a_probe',
  },
  {
    slug: 'odonien',
    canonicalUrl: 'https://odonien.ticket.io/',
    organizerName: 'Odonien',
    city: 'Köln',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3a_probe',
  },
  {
    slug: 'aura',
    canonicalUrl: 'https://aura.ticket.io/',
    city: 'Köln',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3a_network_sample',
  },
  {
    slug: 'tonite',
    canonicalUrl: 'https://tonite.ticket.io/',
    city: 'Köln',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3a_network_sample',
  },
  {
    slug: 'gewoelbe',
    canonicalUrl: 'https://gewoelbe.ticket.io/',
    city: 'Köln',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'nrw_electronic_expansion',
  },
  {
    slug: 'glow',
    canonicalUrl: 'https://glow.ticket.io/',
    city: 'Essen',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'nrw_electronic_expansion',
  },
  {
    slug: 'zakk',
    canonicalUrl: 'https://zakk.ticket.io/',
    organizerName: 'Zakk',
    city: 'Dortmund',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'nrw_electronic_expansion',
  },
  {
    slug: 'nachtresidenz',
    canonicalUrl: 'https://nachtresidenz.ticket.io/',
    city: 'Düsseldorf',
    region: 'NRW',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'nrw_electronic_expansion',
  },
  {
    slug: 'portal-srvded',
    canonicalUrl: 'https://portal.srvded.ticket.io/',
    region: 'NRW',
    discoveryMethod: 'portal_reference',
    discoveredFrom: 'm9.3a_probe',
  },
];

export function normalizeTicketIoShopUrl(url: string): string | null {
  const canonical = canonicalizeTicketIoUrl(url);
  if (!canonical || !isTicketIoShopRootUrl(canonical)) {
    return null;
  }
  return canonical;
}

export function shopSlugFromUrl(shopUrl: string): string | null {
  try {
    return new URL(shopUrl).hostname.split('.')[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function ticketIoShopRootFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!isTicketIoHost(parsed.hostname)) {
      return null;
    }
    return `https://${parsed.hostname.toLowerCase()}/`;
  } catch {
    return null;
  }
}

export function mergeShopSeeds(
  seeds: TicketIoShopSeed[],
  discoveredUrls: string[],
  discoveredFrom: string,
  method: TicketIoDiscoveryMethod,
): TicketIoShopSeed[] {
  const byUrl = new Map(seeds.map((seed) => [seed.canonicalUrl.toLowerCase(), seed]));
  for (const rawUrl of discoveredUrls) {
    const canonical = normalizeTicketIoShopUrl(rawUrl) ?? ticketIoShopRootFromUrl(rawUrl);
    if (!canonical || byUrl.has(canonical.toLowerCase())) {
      continue;
    }
    const slug = shopSlugFromUrl(canonical);
    if (!slug) {
      continue;
    }
    byUrl.set(canonical.toLowerCase(), {
      slug,
      canonicalUrl: canonical,
      discoveryMethod: method,
      discoveredFrom,
    });
  }
  return [...byUrl.values()];
}
