/**
 * Curated seed URLs for Ticket.io shop discovery.
 * These are independent electronic-music organizers/clubs — not Bootshaus.
 * Limitations: no public ticket.io shop directory; seeds must be maintained manually.
 */
export interface TicketIoSeedEntry {
  shopSlug: string;
  listUrl: string;
  label: string;
  region?: string;
  notes?: string;
}

export const TICKET_IO_ELECTRONIC_SEED_SHOPS: TicketIoSeedEntry[] = [
  {
    shopSlug: 'technodampfer',
    listUrl: 'https://technodampfer.ticket.io/',
    label: 'Techno Dampfer',
    region: 'DE/EU',
    notes: 'Floating techno festival series across German cities.',
  },
  {
    shopSlug: 'proton-the-club',
    listUrl: 'https://proton-the-club.ticket.io/',
    label: 'Proton The Club',
    region: 'Stuttgart',
    notes: 'Hardtechno and techno club nights.',
  },
  {
    shopSlug: 'lehmannclub',
    listUrl: 'https://lehmannclub.ticket.io/',
    label: 'Lehmann Club',
    region: 'Stuttgart',
    notes: 'Techno/house club programme.',
  },
  {
    shopSlug: 'area51events',
    listUrl: 'https://area51events.ticket.io/',
    label: 'AREA51 Events',
    region: 'Düsseldorf',
    notes: 'Techno events at Schlachthof Düsseldorf.',
  },
  {
    shopSlug: 'hmg-concerts',
    listUrl: 'https://hmg-concerts.ticket.io/',
    label: 'HMG Concerts',
    region: 'Dresden',
    notes: 'Techno club and concert events.',
  },
  {
    shopSlug: 'elektrokueche',
    listUrl: 'https://elektrokueche.ticket.io/',
    label: 'Elektroküche',
    region: 'Köln',
    notes: 'Cologne electronic music collective.',
  },
  {
    shopSlug: 'mdma-musik',
    listUrl: 'https://mdma-musik.ticket.io/',
    label: 'MDMA Musik',
    region: 'NRW',
    notes: 'Electronic music events organizer.',
  },
  {
    shopSlug: 'nibirii',
    listUrl: 'https://nibirii.ticket.io/',
    label: 'Nibirii Festival',
    region: 'DE',
    notes: 'Electronic open-air festival.',
  },
  {
    shopSlug: 'rheinaudio',
    listUrl: 'https://rheinaudio.ticket.io/',
    label: 'RheinAudio',
    region: 'NRW',
    notes: 'Cologne-area electronic events.',
  },
  {
    shopSlug: 'loonyland',
    listUrl: 'https://loonyland.ticket.io/',
    label: 'Loonyland',
    region: 'DE',
    notes: 'Electronic festival and club events.',
  },
];

export function collectTicketIoSeedCorpusTexts(): string[] {
  return TICKET_IO_ELECTRONIC_SEED_SHOPS.map(
    (entry) => `${entry.listUrl}\n${entry.label}\n${entry.shopSlug}\n${entry.notes ?? ''}`,
  );
}

export function listTicketIoSeedSlugs(): string[] {
  return TICKET_IO_ELECTRONIC_SEED_SHOPS.map((entry) => entry.shopSlug);
}
