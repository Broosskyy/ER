import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';
import { normalizeExtractedTicketPlatformPageTitle } from '@/features/import/ticket-platform-identity/identity-match';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';

import type { ParsedTicketPlatformEvent } from './types';

function stripHtmlText(value: string): string {  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

export interface TicketPlatformEvidenceMetadataInput {
  event: ParsedTicketPlatformEvent;
  connectorKey: string;
  platform: string;
  shopSlug: string;
  enrichmentSource?: boolean;
  observedAt: string;
  verifiedAt?: string;
  detailHtml?: string;
  checkoutUrl?: string;
  listRowTitle?: string;
  scopeStats?: Record<string, unknown>;
}

function extractPageTitleFromHtml(html: string | undefined): string | undefined {
  if (!html?.trim()) {
    return undefined;
  }
  const ogMatch =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogMatch?.[1]) {
    return decodeHtmlEntities(ogMatch[1]).trim() || undefined;
  }
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]).trim() || undefined : undefined;
}

function extractListRowTitleFromDetailHtml(
  html: string | undefined,
  platform: string,
): string | undefined {
  if (!html?.trim()) {
    return undefined;
  }
  if (platform === 'ticket_king') {
    const espbpMatch = html.match(/<div class="espbp-title-date"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (espbpMatch?.[1]) {
      const title = stripHtmlText(espbpMatch[1]);
      return title || undefined;
    }
  }
  return undefined;
}

/** Builds typed page identity, freshness, and URL-role evidence for the import truth pipeline. */
export function buildTicketPlatformEvidenceMetadata(
  input: TicketPlatformEvidenceMetadataInput,
): Record<string, unknown> {
  const { event } = input;
  const pageTitleRaw = extractPageTitleFromHtml(input.detailHtml);
  const pageTitle = pageTitleRaw
    ? normalizeExtractedTicketPlatformPageTitle(pageTitleRaw)
    : undefined;
  const listRowTitle =
    input.listRowTitle?.trim() ||
    extractListRowTitleFromDetailHtml(input.detailHtml, input.platform) ||
    undefined;
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

  if (input.checkoutUrl?.trim()) {
    checkoutEvidenceUrl = input.checkoutUrl.trim();
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
    ...(pageTitleRaw && pageTitleRaw !== pageTitle ? { pageTitleRaw } : {}),
    listRowTitle,
    eventDate: event.startDate,
    venueName: event.venueName,
    observedAt,
    verifiedAt,
    publicCtaCandidateUrl,
    publicTicketPageUrl,
    checkoutEvidenceUrl,
    sourceRoles: ['ticketing', 'enrichment'],
    ...(event.checkoutProviderId ? { checkoutProviderId: event.checkoutProviderId } : {}),
  };
}
