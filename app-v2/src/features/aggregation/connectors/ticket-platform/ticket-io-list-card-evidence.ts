import { parseGermanPriceText } from './format-ticket-price';
import { classifyTicketIoDetailHtml } from './ticket-io-detail-classification';
import type { TicketIoListRowContext } from './ticket-io-list-enrichment';
import type { TicketIoTicketOffer } from './ticket-io-detail-parser';
import type { ParsedTicketPlatformEvent } from './types';
import { evaluatePublicIdentityMatch } from '@/features/import/ticket-platform-identity/identity-match';
import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

export type TicketIoDetailFetchStatus = 'ok' | 'pow_challenge' | 'missing';

export const TICKET_IO_PUBLIC_SHOP_LIST_EVIDENCE_ROLE = 'public_shop_list';

export interface TicketIoListCardEvidence {
  listRowTitle: string;
  eventDate?: string;
  venueName?: string;
  priceText?: string;
  publicTicketPageUrl?: string;
  eventSlug?: string;
  evidenceRole: typeof TICKET_IO_PUBLIC_SHOP_LIST_EVIDENCE_ROLE;
  detailFetchStatus: TicketIoDetailFetchStatus;
  observedAt: string;
  verifiedAt?: string;
  soldOut?: boolean;
  identityEvidenceConflict?: boolean;
}

export interface BuildTicketIoListCardEvidenceInput {
  event: ParsedTicketPlatformEvent;
  listContext?: TicketIoListRowContext;
  detailHtml?: string;
  detailFetchStatus: TicketIoDetailFetchStatus;
  observedAt: string;
  verifiedAt?: string;
  detailPageTitle?: string;
}

function extractDetailPageTitle(detailHtml: string | undefined): string | undefined {
  if (!detailHtml?.trim()) {
    return undefined;
  }
  const ogMatch =
    detailHtml.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
    detailHtml.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogMatch?.[1]) {
    return decodeHtmlEntities(ogMatch[1]).trim() || undefined;
  }
  const titleMatch = detailHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]).trim() || undefined : undefined;
}

export function resolveTicketIoDetailFetchStatus(detailHtml?: string): TicketIoDetailFetchStatus {
  return classifyTicketIoDetailHtml(detailHtml).detailFetchStatus;
}

export function ticketIoListDetailIdentityConflict(
  detailPageTitle: string | undefined,
  listRowTitle: string | undefined,
  eventDate?: string,
  venueName?: string,
): boolean {
  if (!detailPageTitle?.trim() || !listRowTitle?.trim()) {
    return false;
  }
  const match = evaluatePublicIdentityMatch(
    { eventId: 'list-card', title: listRowTitle },
    { pageTitle: detailPageTitle, eventDate, venueName },
  );
  return match.match === 'mismatch';
}

/** Builds same-card shop list evidence for Ticket.io when detail pages are unavailable or PoW-blocked. */
export function buildTicketIoListCardEvidence(
  input: BuildTicketIoListCardEvidenceInput,
): TicketIoListCardEvidence | undefined {
  const listRowTitle = input.event.title?.trim();
  if (!listRowTitle) {
    return undefined;
  }

  const detailStatus = input.detailFetchStatus;
  const detailPageTitle =
    input.detailPageTitle?.trim() ||
    (detailStatus === 'ok' ? extractDetailPageTitle(input.detailHtml) : undefined);
  const identityEvidenceConflict =
    detailStatus === 'ok' &&
    ticketIoListDetailIdentityConflict(
      detailPageTitle,
      listRowTitle,
      input.event.startDate,
      input.event.venueName,
    );

  const admissionPriceText =
    input.listContext?.priceText ??
    (input.listContext?.soldOut ? 'Ausverkauft' : undefined);

  return {
    listRowTitle,
    eventDate: input.event.startDate,
    venueName: input.event.venueName,
    priceText: admissionPriceText,
    publicTicketPageUrl: input.event.ticketUrl,
    eventSlug: input.event.eventSlug,
    evidenceRole: TICKET_IO_PUBLIC_SHOP_LIST_EVIDENCE_ROLE,
    detailFetchStatus: detailStatus,
    observedAt: input.observedAt,
    verifiedAt: input.verifiedAt ?? input.observedAt,
    soldOut: input.listContext?.soldOut,
    ...(identityEvidenceConflict ? { identityEvidenceConflict: true } : {}),
  };
}

/** Admission offers from the visible list-card price only (never detail or add-on surfaces). */
export function buildListCardAdmissionOffers(
  listContext: TicketIoListRowContext | undefined,
  ticketUrl: string | undefined,
): TicketIoTicketOffer[] | undefined {
  if (!listContext) {
    return undefined;
  }
  if (listContext.soldOut) {
    return [
      {
        name: 'List admission',
        soldOut: true,
        purchaseUrl: ticketUrl,
      },
    ];
  }
  if (!listContext.priceText) {
    return undefined;
  }
  const parsed = parseGermanPriceText(listContext.priceText);
  if (!parsed.amount) {
    return undefined;
  }
  return [
    {
      name: 'List admission',
      priceAmount: parsed.amount,
      priceCurrency: parsed.currency ?? 'EUR',
      purchaseUrl: ticketUrl,
    },
  ];
}
