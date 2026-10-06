import { TICKET_IO_SHOP_SEEDS, type TicketIoShopSeed } from './shop-seeds';

/**
 * Germany-wide ticket.io shop seeds beyond the original NRW-focused list.
 * Outbound link traversal from these seeds expands the network without per-shop connectors.
 */
export const TICKET_IO_GERMANY_EXPANSION_SEEDS: TicketIoShopSeed[] = [
  // Berlin
  {
    slug: 'about-blank',
    canonicalUrl: 'https://about-blank.ticket.io/',
    organizerName: '://about blank',
    city: 'Berlin',
    region: 'Berlin',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'rso-berlin',
    canonicalUrl: 'https://rso-berlin.ticket.io/',
    city: 'Berlin',
    region: 'Berlin',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'watergate',
    canonicalUrl: 'https://watergate.ticket.io/',
    organizerName: 'Watergate',
    city: 'Berlin',
    region: 'Berlin',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'renate',
    canonicalUrl: 'https://renate.ticket.io/',
    city: 'Berlin',
    region: 'Berlin',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  // Hamburg
  {
    slug: 'dukes',
    canonicalUrl: 'https://dukes.ticket.io/',
    city: 'Hamburg',
    region: 'Hamburg',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'moondi',
    canonicalUrl: 'https://moondi.ticket.io/',
    city: 'Hamburg',
    region: 'Hamburg',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'drei',
    canonicalUrl: 'https://drei.ticket.io/',
    city: 'Hamburg',
    region: 'Hamburg',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  // München / Bayern
  {
    slug: 'blur',
    canonicalUrl: 'https://blur.ticket.io/',
    city: 'München',
    region: 'Bayern',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'rave-bahnhof',
    canonicalUrl: 'https://rave-bahnhof.ticket.io/',
    city: 'München',
    region: 'Bayern',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'kw-oberbayern',
    canonicalUrl: 'https://kw-oberbayern.ticket.io/',
    region: 'Bayern',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  // Leipzig / Sachsen
  {
    slug: 'ifz-leipzig',
    canonicalUrl: 'https://ifz-leipzig.ticket.io/',
    city: 'Leipzig',
    region: 'Sachsen',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'distillery',
    canonicalUrl: 'https://distillery.ticket.io/',
    city: 'Leipzig',
    region: 'Sachsen',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  // Frankfurt / Hessen
  {
    slug: 'zoom',
    canonicalUrl: 'https://zoom.ticket.io/',
    city: 'Frankfurt am Main',
    region: 'Hessen',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'robert-johnson',
    canonicalUrl: 'https://robert-johnson.ticket.io/',
    city: 'Frankfurt am Main',
    region: 'Hessen',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  // Stuttgart / Baden-Württemberg
  {
    slug: 'le-fonque',
    canonicalUrl: 'https://le-fonque.ticket.io/',
    city: 'Stuttgart',
    region: 'Baden-Württemberg',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'freiburg',
    canonicalUrl: 'https://freiburg.ticket.io/',
    city: 'Freiburg im Breisgau',
    region: 'Baden-Württemberg',
    discoveryMethod: 'seed_list',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  // Nationwide portals / cross-region discovery anchors
  {
    slug: 'portal',
    canonicalUrl: 'https://portal.ticket.io/',
    region: 'Germany',
    discoveryMethod: 'portal_reference',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
  {
    slug: 'events',
    canonicalUrl: 'https://events.ticket.io/',
    region: 'Germany',
    discoveryMethod: 'portal_reference',
    discoveredFrom: 'm9.3b.3_germany_expansion',
  },
];

/** Merged NRW foundation + Germany-wide expansion seeds (deduped by canonical URL). */
export function buildGermanyShopSeeds(): TicketIoShopSeed[] {
  const byUrl = new Map<string, TicketIoShopSeed>();
  for (const seed of [...TICKET_IO_SHOP_SEEDS, ...TICKET_IO_GERMANY_EXPANSION_SEEDS]) {
    const key = seed.canonicalUrl.toLowerCase();
    if (!byUrl.has(key)) {
      byUrl.set(key, seed);
    }
  }
  return [...byUrl.values()];
}
