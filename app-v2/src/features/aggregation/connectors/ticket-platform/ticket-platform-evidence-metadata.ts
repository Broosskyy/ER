import type { ParsedTicketPlatformEvent } from './types';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';

export interface TicketPlatformEvidenceMetadataInput {
  event: ParsedTicketPlatformEvent;
  connectorKey: string;
  platform: string;
  shopSlug: string;
  enrichmentSource?: boolean;
  observedAt?: string;
  verifiedAt?: string;
  listRowTitle?: string;
  sourceRoles?: string[];
  trustScore?: number;
  scopeStats?: Record<string, unknown>;
  checkoutProviderId?: string;
}

/** Builds typed page identity + URL role evidence for the import truth pipeline. */
export function buildTicketPlatformEvidenceMetadata(
  input: TicketPlatformEvidenceMetadataInput,
): Record<string, unknown> {
  const { event } = input;
  const pageTitle = event.title?.trim() || undefined;
  const listRowTitle = input.listRowTitle?.trim() || pageTitle;
  const ticketUrl = event.ticketUrl?.trim();
  const classified = ticketUrl ? classifyTicketDestination(ticketUrl) : undefined;

  let publicCtaCandidateUrl: string | undefined;
  let checkoutEvidenceUrl: string | undefined;
  let publicTicketPageUrl: string | undefined;

  if (ticketUrl && classified) {
    if (classified.destinationClass === 'embedded_checkout_evidence') {
      checkoutEvidenceUrl = ticketUrl;
    } else if (
      classified.destinationClass === 'ticket_platform_event' ||
      classified.destinationClass === 'direct_purchase' ||
      classified.destinationClass === 'ticket_platform_listing'
    ) {
      publicTicketPageUrl = ticketUrl;
      publicCtaCandidateUrl = ticketUrl;
    } else if (classified.destinationClass === 'official_event_page') {
      publicCtaCandidateUrl = ticketUrl;
    }
  }

  const verifiedAt =
    typeof input.verifiedAt === 'string' && input.verifiedAt.trim()
      ? input.verifiedAt.trim()
      : undefined;
  const observedAt =
    typeof input.observedAt === 'string' && input.observedAt.trim()
      ? input.observedAt.trim()
      : verifiedAt;

  return {
    connector: input.connectorKey,
    platform: input.platform,
    shopSlug: input.shopSlug,
    enrichmentSource: input.enrichmentSource ?? true,
    scopeStats: input.scopeStats,
    pageTitle,
    listRowTitle,
    eventDate: event.startDate,
    venueName: event.venueName,
    observedAt,
    verifiedAt,
    publicCtaCandidateUrl,
    publicTicketPageUrl,
    checkoutEvidenceUrl,
    sourceRoles: input.sourceRoles ?? ['ticketing', 'enrichment'],
    trustScore: input.trustScore,
    ...(input.checkoutProviderId ? { checkoutProviderId: input.checkoutProviderId } : {}),
    ...(event.checkoutProviderId ? { checkoutProviderId: event.checkoutProviderId } : {}),
  };
}
