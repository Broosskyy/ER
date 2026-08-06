export const PHASE48621_R3HAB_EVENT_ID = 'evt-1785339421539-k3swcrl';
export const PHASE48621_UNDERLAND_EVENT_ID = 'evt-1785389049895-4mb7dub';
export const PHASE48621_COLLISION_SLUG = 'C7JPnatZ';
export const PHASE48621_COLLISION_HOST = 'bootshaus-club.ticket.io';

export type TicketPlatformKind = 'ticket_io' | 'ticket_king' | 'nacht_manager' | 'unknown';

export type UnderlandTicketDestinationVerdict =
  | 'CURRENT_TICKETIO_EVENT_CONFIRMED'
  | 'CURRENT_TICKET_KINGS_EVENT_CONFIRMED'
  | 'OFFICIAL_PAGE_ONLY'
  | 'STALE_TICKET_CANDIDATE'
  | 'WRONG_EVENT_TICKET_URL'
  | 'TICKET_DESTINATION_NOT_PUBLICLY_VERIFIABLE'
  | 'REVIEW_REQUIRED';

export type R3habTicketDestinationVerdict =
  | 'ELIGIBLE_FOR_CONTROLLED_TICKETIO_ENRICHMENT'
  | 'CURRENT_TICKETIO_EVENT_CONFIRMED'
  | 'REVIEW_REQUIRED'
  | 'WRONG_EVENT_TICKET_URL'
  | 'TICKET_DESTINATION_NOT_PUBLICLY_VERIFIABLE';

export interface TicketPlatformCompositeIdentity {
  platform: TicketPlatformKind;
  host: string;
  externalId: string;
  normalizedUrl: string;
  compositeKey: string;
}

export interface EventIdentitySnapshot {
  eventId: string;
  title: string;
  startDate?: string;
  venueName?: string;
  venueCity?: string;
  ticketUrl?: string;
  websiteUrl?: string;
  sourceId?: string;
}

export interface PublicIdentityEvidence {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  redirectChain: string[];
  pageTitle?: string;
  listRowTitle?: string;
  eventDate?: string;
  venueName?: string;
  ticketPlatform?: TicketPlatformKind;
  host?: string;
  slug?: string;
  ticketCtaUrl?: string;
  rawPrice?: string;
  availability?: string;
  observedAt: string;
  contentHash: string;
  identityMatch: 'exact' | 'partial' | 'mismatch' | 'unverifiable';
  identityMatchReason: string;
}

export interface CompositeIdentityCollision {
  compositeKey: string;
  platform: TicketPlatformKind;
  host: string;
  externalId: string;
  eventIds: string[];
  titles: string[];
  collisionType: 'exact_duplicate' | 'stale_alias' | 'review_required';
}

export interface IdentityCorrectionPreview {
  eventId: string;
  title: string;
  field: string;
  relationship?: string;
  currentValue: unknown;
  proposedValue: unknown;
  publicEvidence: string;
  historicalProvenance: string;
  reason: string;
  risk: 'low' | 'medium' | 'high';
  consumerEffect: string;
  rollbackValue: unknown;
  frozenDomains: string[];
}
