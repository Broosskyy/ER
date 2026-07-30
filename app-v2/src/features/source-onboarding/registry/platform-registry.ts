export type PlatformCapability =
  | 'list_discovery'
  | 'detail_discovery'
  | 'json_ld'
  | 'ticket_checkout'
  | 'electronic_scope_filter'
  | 'onboarding_supported';

export interface PlatformRegistryEntry {
  id: string;
  label: string;
  hostPatterns: RegExp[];
  capabilities: PlatformCapability[];
  adapterRequired: boolean;
  productionReady: boolean;
  notes?: string;
}

export const PLATFORM_REGISTRY: PlatformRegistryEntry[] = [
  {
    id: 'ticket_io',
    label: 'ticket.io',
    hostPatterns: [/\.ticket\.io$/i],
    capabilities: ['list_discovery', 'json_ld', 'ticket_checkout', 'onboarding_supported', 'electronic_scope_filter'],
    adapterRequired: true,
    productionReady: true,
    notes: 'Per-organizer white-label shops only — no public platform-wide event index. Discovery mines *.ticket.io URLs from corpus.',
  },
  {
    id: 'ticket_king',
    label: 'Ticket Kings',
    hostPatterns: [/^ticketkings\.de$/i, /^www\.ticketkings\.de$/i],
    capabilities: ['list_discovery', 'json_ld', 'ticket_checkout', 'onboarding_supported', 'electronic_scope_filter'],
    adapterRequired: true,
    productionReady: true,
    notes: 'Platform-wide public list at /all-events/ with HTML pagination.',
  },
  {
    id: 'bootshaus_website',
    label: 'Bootshaus Website',
    hostPatterns: [/^bootshaus\.tv$/i],
    capabilities: ['list_discovery', 'html_cards'],
    adapterRequired: false,
    productionReady: true,
    notes: 'Reference club website connector.',
  },
  {
    id: 'affenkaefig_website',
    label: 'Affenkäfig Website',
    hostPatterns: [/^affenkaefig\.info$/i],
    capabilities: ['list_discovery', 'json_ld'],
    adapterRequired: false,
    productionReady: true,
  },
  {
    id: 'resident_advisor',
    label: 'Resident Advisor',
    hostPatterns: [/^ra\.co$/i],
    capabilities: ['list_discovery'],
    adapterRequired: true,
    productionReady: false,
    notes: 'Placeholder — adapter not implemented in Sprint 33.',
  },
  {
    id: 'dice',
    label: 'DICE',
    hostPatterns: [/^dice\.fm$/i],
    capabilities: ['list_discovery'],
    adapterRequired: true,
    productionReady: false,
  },
  {
    id: 'shotgun',
    label: 'Shotgun',
    hostPatterns: [/^shotgun\.live$/i],
    capabilities: ['list_discovery'],
    adapterRequired: true,
    productionReady: false,
  },
  {
    id: 'eventbrite',
    label: 'Eventbrite',
    hostPatterns: [/^eventbrite\.(com|de)$/i],
    capabilities: ['list_discovery'],
    adapterRequired: true,
    productionReady: false,
  },
  {
    id: 'wordpress_tribe',
    label: 'WordPress Tribe Events',
    hostPatterns: [],
    capabilities: ['list_discovery', 'json_ld', 'ticket_checkout'],
    adapterRequired: false,
    productionReady: false,
    notes: 'Detected via HTML signatures, not hostname.',
  },
];

export function detectPlatformFromHostname(hostname: string): PlatformRegistryEntry | undefined {
  const normalized = hostname.toLowerCase();
  return PLATFORM_REGISTRY.find((entry) =>
    entry.hostPatterns.some((pattern) => pattern.test(normalized)),
  );
}
