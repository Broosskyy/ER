import { createHash } from 'node:crypto';

import { classifyTicketOfferRole, isAdmissionOfferRole } from './ticket-offer-role';
import { normalizeTicketPriceLine } from './normalize-ticket-price';
import type { TicketOfferRole, VerifiedTicketStatus } from './types';
import { canonicalizeTicketIoUrl, extractTicketIoProviderEventId } from './url-policy';
import { isTicketProviderBlockedBody } from './safe-fetch-ticket';

export type CachedResponseClassification =
  | 'security_challenge_only'
  | 'event_dom_present'
  | 'event_dom_partial'
  | 'public_structured_data_present';

export interface TicketIoDetailDomOffer {
  rawLabel: string;
  role: TicketOfferRole;
  rawPrice?: string;
  amountMinor?: number;
  currency?: string;
  soldOut: boolean;
  purchasable: boolean;
}

export interface TicketIoDetailDomEvidence {
  providerEventId?: string;
  eventTitle?: string;
  startAt?: string;
  venueName?: string;
  canonicalTicketUrl?: string;
  ticketStatus: VerifiedTicketStatus;
  offers: TicketIoDetailDomOffer[];
  admissionOffers: TicketIoDetailDomOffer[];
  rejectedOffers: Array<{ rawLabel: string; reason: string }>;
  contentFingerprint: string;
  evidenceRole: 'public_event_detail_dom';
}

const SOLD_OUT_PATTERN = /\b(?:sold\s*out|ausverkauft)\b/i;
const SALE_NOT_STARTED_PATTERN = /\b(?:sale\s+starts|verkaufsstart|not\s+on\s+sale)\b/i;
const SALES_ENDED_PATTERN = /\b(?:sales?\s+ended|verkauf\s+beendet)\b/i;
const EVENT_SOLD_OUT_PATTERN = /\b(?:event\s+sold\s*out|veranstaltung\s+ausverkauft)\b/i;

function fingerprintBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

export function classifyCachedTicketIoResponse(
  body: string,
  contentType = 'text/html',
): CachedResponseClassification {
  const hasChallenge = isTicketProviderBlockedBody(body, contentType);
  const hasJsonLd = /application\/ld\+json/i.test(body) && /"@type"\s*:\s*"MusicEvent"/i.test(body);
  const hasEventDom =
    /data-search=|class="a-eventlink"|event-row-|product-row|ticket-category|select-quantity/i.test(body);
  const hasPartialDom = /window\.publicShopInfo|eventoverview|btn-toshop/i.test(body);

  if (hasJsonLd) {
    return 'public_structured_data_present';
  }
  if (hasEventDom && !hasChallenge) {
    return 'event_dom_present';
  }
  if (hasEventDom && hasChallenge) {
    return 'event_dom_partial';
  }
  if (hasPartialDom && !hasChallenge && !hasJsonLd) {
    return 'event_dom_partial';
  }
  if (hasChallenge) {
    return 'security_challenge_only';
  }
  if (hasPartialDom) {
    return 'event_dom_partial';
  }
  return 'security_challenge_only';
}

function extractJsonLdEvent(body: string): Record<string, unknown> | undefined {
  const match = body.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    return String(parsed['@type'] ?? '').includes('MusicEvent') ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function extractEmbeddedJsonPayload(body: string): {
  statusText?: string;
  offers?: Array<{ label?: string; price?: string; status?: string; feeNotice?: string }>;
} | undefined {
  const scriptMatch = body.match(
    /<script[^>]*type=["']application\/json["'][^>]*id=["']ticket-event-data["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!scriptMatch?.[1]) {
    return undefined;
  }
  try {
    return JSON.parse(scriptMatch[1]) as {
      statusText?: string;
      offers?: Array<{ label?: string; price?: string; status?: string; feeNotice?: string }>;
    };
  } catch {
    return undefined;
  }
}

function parseEmbeddedJsonOffers(body: string): TicketIoDetailDomOffer[] {
  const payload = extractEmbeddedJsonPayload(body);
  if (!payload?.offers) {
    return [];
  }
  const offers: TicketIoDetailDomOffer[] = [];
  for (const offer of payload.offers) {
    const rawLabel = String(offer.label ?? '').trim();
    const rawPrice = String(offer.price ?? '').trim();
    const soldOut = SOLD_OUT_PATTERN.test(String(offer.status ?? ''));
    const purchasable = !soldOut && (/available|instock|^$/i.test(String(offer.status ?? '').trim()) || !offer.status);
    const role = classifyTicketOfferRole(rawLabel);
    const normalized = rawPrice ? normalizeTicketPriceLine(rawPrice) : undefined;
    offers.push({
      rawLabel,
      role,
      rawPrice: rawPrice || undefined,
      amountMinor: normalized?.amountMinor,
      currency: normalized?.currency,
      soldOut,
      purchasable,
    });
  }
  return offers;
}

function parseDomOffers(body: string): TicketIoDetailDomOffer[] {
  const offers: TicketIoDetailDomOffer[] = [];
  const rowPattern =
    /<tr[^>]*data-product[^>]*>[\s\S]*?<td[^>]*class="[^"]*product-name[^"]*"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*class="[^"]*product-price[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(body)) !== null) {
    const rawLabel = match[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
    const rawPrice = match[2]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
    const soldOut = SOLD_OUT_PATTERN.test(match[0]);
    const purchasable = /select-quantity|add-to-cart|in\s+den\s+warenkorb/i.test(match[0]) && !soldOut;
    const role = classifyTicketOfferRole(rawLabel);
    const normalized = rawPrice ? normalizeTicketPriceLine(rawPrice) : undefined;
    offers.push({
      rawLabel,
      role,
      rawPrice: rawPrice || undefined,
      amountMinor: normalized?.amountMinor,
      currency: normalized?.currency,
      soldOut,
      purchasable,
    });
  }
  return offers;
}

function deriveStatusFromOffers(
  body: string,
  admissionOffers: TicketIoDetailDomOffer[],
): VerifiedTicketStatus {
  if (EVENT_SOLD_OUT_PATTERN.test(body)) {
    return 'sold_out';
  }
  if (SALE_NOT_STARTED_PATTERN.test(body)) {
    return 'sale_not_started';
  }
  if (SALES_ENDED_PATTERN.test(body)) {
    return 'sales_ended';
  }
  const purchasableAdmission = admissionOffers.filter((offer) => offer.purchasable && !offer.soldOut);
  if (purchasableAdmission.length > 0) {
    return 'available';
  }
  if (admissionOffers.length > 0 && admissionOffers.every((offer) => offer.soldOut || SOLD_OUT_PATTERN.test(offer.rawLabel))) {
    return 'sold_out';
  }
  if (admissionOffers.length === 0 && EVENT_SOLD_OUT_PATTERN.test(body)) {
    return 'sold_out';
  }
  return 'unavailable_unknown';
}

export function parseTicketIoDetailDom(
  body: string,
  expected?: { shopHost?: string; providerEventId?: string; sourceUrl?: string },
): TicketIoDetailDomEvidence | undefined {
  const hasEmbeddedJson = Boolean(extractEmbeddedJsonPayload(body));
  const classification = classifyCachedTicketIoResponse(body);
  if (classification === 'security_challenge_only' && !hasEmbeddedJson) {
    return undefined;
  }

  const jsonLd = extractJsonLdEvent(body);
  const embeddedOffers = parseEmbeddedJsonOffers(body);
  const domOffers = parseDomOffers(body);
  const offers = embeddedOffers.length > 0 ? embeddedOffers : domOffers.length > 0 ? domOffers : [];

  const eventTitle = jsonLd ? String(jsonLd.name ?? '').trim() : undefined;
  const startAt = jsonLd ? String(jsonLd.startDate ?? '').trim() : undefined;
  const location = jsonLd?.location as Record<string, unknown> | undefined;
  const venueName = location ? String(location.name ?? '').trim() : undefined;
  const offer = jsonLd?.offers as Record<string, unknown> | undefined;
  const offerUrl = offer ? String(offer.url ?? '').trim() : expected?.sourceUrl;
  const canonicalTicketUrl = offerUrl ? canonicalizeTicketIoUrl(offerUrl) : undefined;
  const providerEventId =
    expected?.providerEventId ??
    (canonicalTicketUrl ? extractTicketIoProviderEventId(canonicalTicketUrl) : undefined);

  if (offer && offers.length === 0) {
    const label = String(offer.name ?? 'Admission').trim() || 'Admission';
    const priceText =
      typeof offer.price === 'number'
        ? `ab ${String(offer.price).replace('.', ',')} ${String(offer.priceCurrency ?? 'EUR')}`
        : String(offer.price ?? '');
    const normalized = priceText ? normalizeTicketPriceLine(priceText) : undefined;
    const soldOut = /soldout|sold_out/i.test(String(offer.availability ?? ''));
    offers.push({
      rawLabel: label,
      role: classifyTicketOfferRole(label),
      rawPrice: normalized?.rawPrice,
      amountMinor: normalized?.amountMinor,
      currency: normalized?.currency ?? String(offer.priceCurrency ?? ''),
      soldOut,
      purchasable: !soldOut,
    });
  }

  const admissionOffers = offers.filter((offer) => isAdmissionOfferRole(offer.role));
  const purchasableAdmission = admissionOffers.filter((offer) => offer.purchasable && !offer.soldOut);
  const rejectedOffers = [
    ...offers
      .filter((offer) => !isAdmissionOfferRole(offer.role))
      .map((offer) => ({ rawLabel: offer.rawLabel, reason: 'non_admission_offer' })),
    ...offers
      .filter((offer) => isAdmissionOfferRole(offer.role) && (offer.soldOut || !offer.purchasable))
      .map((offer) => ({ rawLabel: offer.rawLabel, reason: 'offer_not_currently_available' })),
  ];

  if (!eventTitle && offers.length === 0 && !jsonLd) {
    return undefined;
  }

  const ticketStatus = deriveStatusFromOffers(body, purchasableAdmission);
  let finalTicketStatus = ticketStatus;
  if (eventTitle && SOLD_OUT_PATTERN.test(eventTitle)) {
    finalTicketStatus = 'sold_out';
  }

  if (expected?.shopHost && canonicalTicketUrl) {
    const host = new URL(canonicalTicketUrl).hostname;
    if (host !== expected.shopHost) {
      return undefined;
    }
  }

  return {
    providerEventId,
    eventTitle,
    startAt,
    venueName,
    canonicalTicketUrl,
    ticketStatus: finalTicketStatus,
    offers,
    admissionOffers,
    rejectedOffers,
    contentFingerprint: fingerprintBody(body),
    evidenceRole: 'public_event_detail_dom',
  };
}
