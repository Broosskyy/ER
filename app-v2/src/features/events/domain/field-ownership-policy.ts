export const SOURCE_PRIORITY_TIERS = [
  'official_organizer',
  'official_venue',
  'official_festival',
  'promoter',
  'specialized_platform',
  'ticket_platform',
  'aggregator',
  'community',
] as const;

export type SourcePriorityTier = (typeof SOURCE_PRIORITY_TIERS)[number];

export interface FieldOwnershipRule {
  field: string;
  ownerTier: SourcePriorityTier;
  allowEnrichmentFrom?: SourcePriorityTier[];
  description: string;
}

export const FIELD_OWNERSHIP_RULES: FieldOwnershipRule[] = [
  { field: 'title', ownerTier: 'official_organizer', description: 'Official organizer or venue title wins.' },
  { field: 'description', ownerTier: 'official_organizer', description: 'Official description wins.' },
  { field: 'startDate', ownerTier: 'official_organizer', description: 'Official schedule wins.' },
  { field: 'endDate', ownerTier: 'official_organizer', description: 'Official schedule wins.' },
  { field: 'venueName', ownerTier: 'official_venue', description: 'Official venue identity wins.' },
  { field: 'venueId', ownerTier: 'official_venue', description: 'Canonical venue link from official source.' },
  { field: 'lineup', ownerTier: 'official_organizer', allowEnrichmentFrom: ['specialized_platform'], description: 'Line-up from official or high-quality platform.' },
  { field: 'ticketUrl', ownerTier: 'ticket_platform', allowEnrichmentFrom: ['ticket_platform'], description: 'Each ticket provider keeps its own URL on origin.' },
  { field: 'priceAmount', ownerTier: 'ticket_platform', allowEnrichmentFrom: ['ticket_platform'], description: 'Prices from ticket provider only.' },
  { field: 'priceCurrency', ownerTier: 'ticket_platform', allowEnrichmentFrom: ['ticket_platform'], description: 'Currency from ticket provider.' },
  { field: 'ticketStatus', ownerTier: 'ticket_platform', allowEnrichmentFrom: ['ticket_platform'], description: 'Availability from ticket provider.' },
  { field: 'imageUrl', ownerTier: 'official_organizer', allowEnrichmentFrom: ['specialized_platform', 'ticket_platform'], description: 'Image by quality and priority scoring.' },
  { field: 'checkoutProviderId', ownerTier: 'ticket_platform', allowEnrichmentFrom: ['ticket_platform'], description: 'Checkout widget metadata from ticket platform.' },
];

export function resolveSourcePriorityTier(input: {
  sourceType?: string;
  sourceRoles?: string[];
  connectorKey?: string;
}): SourcePriorityTier {
  const roles = input.sourceRoles ?? [];
  if (roles.includes('organizer')) {
    return 'official_organizer';
  }
  if (roles.includes('festival')) {
    return 'official_festival';
  }
  if (roles.includes('club') || roles.includes('venue')) {
    return 'official_venue';
  }
  if (roles.includes('ticketing') || input.sourceType === 'ticket_platform') {
    return 'ticket_platform';
  }
  if (input.connectorKey === 'organizer_website' || input.connectorKey === 'club_website') {
    return input.connectorKey === 'club_website' ? 'official_venue' : 'official_organizer';
  }
  if (input.sourceType === 'website') {
    return 'official_organizer';
  }
  return 'aggregator';
}

export function canTierWriteField(
  field: string,
  incomingTier: SourcePriorityTier,
  existingTier: SourcePriorityTier,
): boolean {
  const rule = FIELD_OWNERSHIP_RULES.find((entry) => entry.field === field);
  if (!rule) {
    return tierRank(incomingTier) <= tierRank(existingTier);
  }
  if (incomingTier === rule.ownerTier) {
    return true;
  }
  return rule.allowEnrichmentFrom?.includes(incomingTier) ?? false;
}

function tierRank(tier: SourcePriorityTier): number {
  return SOURCE_PRIORITY_TIERS.indexOf(tier);
}

export function isHigherPriorityTier(
  incoming: SourcePriorityTier,
  existing: SourcePriorityTier,
): boolean {
  return tierRank(incoming) < tierRank(existing);
}
