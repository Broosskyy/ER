export const ACQUISITION_STRATEGIES = [
  'json_ld',
  'wordpress_rest',
  'tribe_events',
  'woocommerce',
  'ical',
  'rss',
  'html_cards',
  'embedded_json',
  'ticket_platform',
] as const;

export type AcquisitionStrategyId = (typeof ACQUISITION_STRATEGIES)[number];

export interface AcquisitionStrategyDescriptor {
  id: AcquisitionStrategyId;
  label: string;
  description: string;
}

export const ACQUISITION_STRATEGY_REGISTRY: AcquisitionStrategyDescriptor[] = [
  { id: 'json_ld', label: 'JSON-LD', description: 'schema.org Event or MusicEvent blocks.' },
  { id: 'tribe_events', label: 'Tribe Events', description: 'WordPress The Events Calendar list/detail pages.' },
  { id: 'ticket_platform', label: 'Ticket Platform', description: 'Generic ticket shop adapters (ticket.io, Ticket Kings).' },
  { id: 'html_cards', label: 'HTML Cards', description: 'Recurring event card markup in list pages.' },
  { id: 'ical', label: 'iCal', description: 'ICS calendar feeds.' },
  { id: 'rss', label: 'RSS/Atom', description: 'Syndication feeds with event entries.' },
  { id: 'embedded_json', label: 'Embedded JSON', description: 'Next.js / Nuxt embedded payloads.' },
  { id: 'wordpress_rest', label: 'WordPress REST', description: 'WP REST API event endpoints.' },
  { id: 'woocommerce', label: 'WooCommerce', description: 'WooCommerce product/event listings.' },
];

export function isAcquisitionStrategyId(value: string): value is AcquisitionStrategyId {
  return (ACQUISITION_STRATEGIES as readonly string[]).includes(value);
}
