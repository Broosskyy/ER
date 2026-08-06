import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';

export type TicketDestinationClass =
  | 'direct_purchase'
  | 'embedded_checkout_evidence'
  | 'ticket_platform_event'
  | 'official_event_page'
  | 'ticket_platform_listing'
  | 'ticket_platform_root'
  | 'organizer_or_venue_homepage'
  | 'redirect_or_tracking'
  | 'invalid'
  | 'unknown';

export type TicketAvailabilityState =
  | 'available'
  | 'limited'
  | 'sold_out'
  | 'presale'
  | 'coming_soon'
  | 'waitlist'
  | 'sales_ended'
  | 'cancelled'
  | 'unavailable'
  | 'unknown';

export type TicketAcceptanceState =
  | 'direct_purchase_correct'
  | 'ticket_event_page_correct'
  | 'official_event_page_only'
  | 'shop_root_fallback_only'
  | 'listing_fallback_only'
  | 'external_detail_blocked'
  | 'source_has_no_ticket_data'
  | 'review_required'
  | 'incorrect';

export interface CanonicalTicketProvenance {
  field: string;
  sourceId?: string;
  originId?: string;
  confidence: number;
  rawValue?: string;
  selectedAt?: string;
}

export interface CanonicalTicketSnapshot {
  officialEventUrl?: string;
  purchaseUrl?: string;
  fallbackTicketUrl?: string;
  publicCtaUrl?: string;
  checkoutEvidenceUrl?: string;
  destinationClass: TicketDestinationClass;
  ticketPlatform?: string;
  ticketStatus?: import('@/features/import/domain/canonical-ticket-phase').AdminEventTicketStatus;
  availability: TicketAvailabilityState;
  currency?: string;
  minimumPrice?: number;
  maximumPrice?: number;
  priceText?: string;
  feesIncluded?: boolean;
  feeText?: string;
  ticketPhases?: CanonicalTicketPhase[];
  presaleStart?: string;
  presaleEnd?: string;
  salesStart?: string;
  salesEnd?: string;
  lastVerifiedAt?: string;
  confidence: number;
  provenance: CanonicalTicketProvenance[];
  detailBlocked: boolean;
  reviewRequired: boolean;
}

export const TICKET_DESTINATION_PRIORITY: Record<TicketDestinationClass, number> = {
  direct_purchase: 100,
  ticket_platform_event: 90,
  official_event_page: 70,
  ticket_platform_listing: 50,
  redirect_or_tracking: 45,
  ticket_platform_root: 30,
  organizer_or_venue_homepage: 20,
  embedded_checkout_evidence: 10,
  unknown: 5,
  invalid: 0,
};

/** URLs with this class may inform price/phases but must never become events.ticket_url. */
export function isPublicConsumerCtaDestinationClass(
  destinationClass: TicketDestinationClass,
): boolean {
  return (
    destinationClass !== 'embedded_checkout_evidence' &&
    destinationClass !== 'invalid' &&
    destinationClass !== 'unknown'
  );
}

export const TICKET_CTA_LABELS_DE: Record<TicketDestinationClass, string | undefined> = {
  direct_purchase: 'Tickets kaufen',
  embedded_checkout_evidence: undefined,
  ticket_platform_event: 'Tickets ansehen',
  official_event_page: 'Eventseite öffnen',
  ticket_platform_listing: 'Tickets suchen',
  ticket_platform_root: 'Ticketshop öffnen',
  organizer_or_venue_homepage: 'Veranstalterseite öffnen',
  redirect_or_tracking: 'Tickets ansehen',
  invalid: undefined,
  unknown: undefined,
};
