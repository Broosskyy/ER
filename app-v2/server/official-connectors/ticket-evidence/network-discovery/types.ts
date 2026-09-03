export type TicketIoShopStatus = 'ACTIVE' | 'INACTIVE' | 'UNREACHABLE' | 'AMBIGUOUS' | 'REJECTED';

export type TicketIoDiscoveryMethod =
  | 'seed_list'
  | 'outbound_link'
  | 'portal_reference'
  | 'staging_ticket_url';

export interface TicketIoShopCandidate {
  shopId: string;
  slug: string;
  canonicalUrl: string;
  organizerName?: string;
  city?: string;
  region?: string;
  discoveryMethod: TicketIoDiscoveryMethod;
  discoveredFrom: string;
  lastSeenAt: string;
  confidence: number;
  status: TicketIoShopStatus;
  upcomingEventCount?: number;
  error?: string;
}

export type ElectronicRelevance =
  | 'HIGH_RELEVANCE'
  | 'LIKELY_RELEVANT'
  | 'AMBIGUOUS'
  | 'IRRELEVANT';

export type TicketIoLifecycleStatus = 'UPCOMING' | 'ONGOING' | 'ENDED';

export type EternalRaveMatchClassification =
  | 'EXISTING_EXACT'
  | 'EXISTING_STRONG_MATCH'
  | 'POSSIBLE_MATCH'
  | 'NET_NEW'
  | 'REVIEW_REQUIRED';

export type TicketIoMediaRole =
  | 'lineup_flyer'
  | 'event_flyer'
  | 'event_hero'
  | 'announcement_flyer'
  | 'ticket_marketing'
  | 'organizer_branding'
  | 'generic_shop_image'
  | 'decorative'
  | 'unknown';

export interface TicketIoVisibleProduct {
  productName?: string;
  rawPrice?: string;
  amountMinor?: number;
  currency?: string;
  availability?: string;
  admissionClass?: string;
}

export interface TicketIoEventDiscoveryCandidate {
  identityKey: string;
  ticketIoEventId: string;
  shopId: string;
  shopSlug: string;
  title: string;
  startsAt?: string;
  endsAt?: string;
  lifecycle: TicketIoLifecycleStatus;
  venueName?: string;
  city?: string;
  address?: string;
  ticketUrl: string;
  canonicalUrl: string;
  description?: string;
  lineupHints: string[];
  genreHints: string[];
  organizerName?: string;
  outboundLinks: string[];
  imageUrls: string[];
  listRawPrice?: string;
  listAmountMinor?: number;
  listCurrency?: string;
  listTicketStatus?: string;
  visibleProducts: TicketIoVisibleProduct[];
  relevance: ElectronicRelevance;
  relevanceReasons: string[];
  matchClassification: EternalRaveMatchClassification;
  matchedEventId?: string;
  matchedEventTitle?: string;
  matchReasons: string[];
  mediaRoles: TicketIoMediaRole[];
  discoveredFromSurfaces: string[];
  contentFingerprint?: string;
}

export interface TicketIoShopValueScore {
  shopId: string;
  slug: string;
  canonicalUrl: string;
  upcomingEventCount: number;
  highRelevanceCount: number;
  likelyRelevantCount: number;
  netNewRelevantCount: number;
  electronicRelevanceRatio: number;
  ticketEvidenceCompleteness: number;
  mediaQualityScore: number;
  tier: 'TIER_1_ENABLE_FIRST' | 'TIER_2_ENABLE_LATER' | 'SUPPLEMENTAL_ONLY' | 'REJECT';
  tierReasons: string[];
}

export interface TicketIoNetworkDiscoverySummary {
  generatedAt: string;
  referenceDateLocal: string;
  timezone: string;
  baselineHead?: string;
  totalShopsDiscovered: number;
  reachableShops: number;
  activeShops: number;
  totalUpcomingTicketIoEvents: number;
  highRelevanceEvents: number;
  likelyRelevantEvents: number;
  ambiguousEvents: number;
  irrelevantEvents: number;
  existingExact: number;
  existingStrongMatch: number;
  possibleMatch: number;
  netNewRelevantEvents: number;
  reviewRequired: number;
  coverageByCity: Record<string, number>;
  coverageByGenre: Record<string, number>;
  newEventWrites: number;
  eventUpdates: number;
  ticketWrites: number;
  mediaWrites: number;
  productionMutations: number;
}
