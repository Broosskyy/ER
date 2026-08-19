import * as cheerio from 'cheerio';

import type {
  EventTicketEvidence,
  TicketEvidenceRequest,
  TicketProviderEventEvidence,
  TicketProviderIdentity,
  VerifiedTicketStatus,
} from './types';
import { buildFourvenuesIdentity } from './build-provider-identity';
import { classifyTicketOffer, isAdmissionOfferRole, isGenericPlaceholderOfferLabel, rejectionReasonForRole } from './ticket-offer-role';
import { selectRegularAdmissionOffer } from './select-regular-admission-offer';
import { normalizeTicketPriceLine } from './normalize-ticket-price';
import {
  normalizeTicketStatusFromText,
  toConsumerNormalizedStatus,
} from './normalize-ticket-status';
import { projectStatusLabel } from './ticket-status-badge';
import {
  canonicalizeFourvenuesUrl,
  extractFourvenuesProviderEventId,
  isFourvenuesEventDetailUrl,
  isFourvenuesHost,
} from './url-policy';
import type { TicketEvidenceProvider } from './types';

function extractJsonLdEvents(body: string): Record<string, unknown>[] {
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const events: Record<string, unknown>[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    try {
      const parsed = JSON.parse(match[1] ?? '') as Record<string, unknown>;
      const type = String(parsed['@type'] ?? '');
      if (type.includes('Event') || type.includes('MusicEvent')) {
        events.push(parsed);
      }
    } catch {
      // ignore
    }
  }
  return events;
}

function pushOfferFromJsonLd(
  offer: Record<string, unknown>,
  offers: EventTicketEvidence['offers'],
  rejectedOffers: EventTicketEvidence['rejectedOffers'],
): void {
  const label = String(offer.name ?? '').trim();
  if (!label || isGenericPlaceholderOfferLabel(label)) {
    rejectedOffers.push({ rawLabel: label || 'unnamed_jsonld_offer', reason: 'unknown_without_admission_evidence' });
    return;
  }
  const classification = classifyTicketOffer({ label });
  const priceAmount = offer.price;
  let amountMinor: number | undefined;
  let rawPrice: string | undefined;
  if (typeof priceAmount === 'number') {
    amountMinor = Math.round(priceAmount * 100);
    rawPrice = `ab ${priceAmount.toFixed(2).replace('.', ',')} €`;
  } else if (typeof priceAmount === 'string') {
    const normalized = normalizeTicketPriceLine(priceAmount);
    amountMinor = normalized.amountMinor;
    rawPrice = normalized.rawPrice;
  }
  const availability = mapAvailability(String(offer.availability ?? ''));
  offers.push({
    rawLabel: label,
    normalizedLabel: label,
    rawPrice,
    amountMinor,
    currency: String(offer.priceCurrency ?? 'EUR'),
    role: classification.role,
    grantsEventEntry: classification.grantsEventEntry,
    requiresBaseTicket: classification.requiresBaseTicket,
    availability,
    confidence: 0.85,
  });
  if (!isAdmissionOfferRole(classification.role)) {
    rejectedOffers.push({ rawLabel: label, rawPrice, reason: rejectionReasonForRole(classification.role) });
  }
}

function mapAvailability(raw?: string): VerifiedTicketStatus {
  const value = String(raw ?? '').toLowerCase();
  if (value.includes('soldout')) {
    return 'sold_out';
  }
  if (value.includes('instock')) {
    return 'available';
  }
  return normalizeTicketStatusFromText(value).status;
}

function buildEvidence(
  request: TicketEvidenceRequest,
  identity: TicketProviderIdentity,
  event: Record<string, unknown> | undefined,
  body: string,
): EventTicketEvidence {
  const $ = cheerio.load(body);
  const offers: EventTicketEvidence['offers'] = [];
  const rejectedOffers: EventTicketEvidence['rejectedOffers'] = [];

  const offer = event?.offers as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  if (Array.isArray(offer)) {
    for (const entry of offer) {
      pushOfferFromJsonLd(entry, offers, rejectedOffers);
    }
  } else if (offer) {
    pushOfferFromJsonLd(offer, offers, rejectedOffers);
  }

  $('.ticket, .ticket-item, [data-ticket], .product-row, .ticket-type, .ticket-card').each((_i, el) => {
    const label = $(el).find('.name, .title, h3, h4').first().text().replace(/\s+/g, ' ').trim();
    const priceText = $(el).find('.price, .amount').first().text().replace(/\s+/g, ' ').trim();
    if (!label && !priceText) {
      return;
    }
    const classification = classifyTicketOffer({ label });
    const normalized = priceText ? normalizeTicketPriceLine(priceText) : undefined;
    const soldOut = /sold\s*out|ausverkauft/i.test($(el).text());
    const availability = soldOut ? 'sold_out' : 'available';
    offers.push({
      rawLabel: label,
      normalizedLabel: label,
      rawPrice: normalized?.rawPrice ?? priceText,
      amountMinor: normalized?.amountMinor,
      currency: normalized?.currency ?? 'EUR',
      role: classification.role,
      grantsEventEntry: classification.grantsEventEntry,
      requiresBaseTicket: classification.requiresBaseTicket,
      availability,
      confidence: 0.75,
    });
    if (!isAdmissionOfferRole(classification.role)) {
      rejectedOffers.push({ rawLabel: label, rawPrice: normalized?.rawPrice ?? priceText, reason: rejectionReasonForRole(classification.role) });
    }
  });

  const location = event?.location as Record<string, unknown> | undefined;
  let ticketStatus: VerifiedTicketStatus = 'unavailable_unknown';
  const regularAdmission = selectRegularAdmissionOffer({
    providerKey: 'fourvenues',
    providerIdentity: identity,
    sourceUrl: request.url.toString(),
    canonicalTicketUrl: request.canonicalTicketUrl,
    sourceObservedAt: request.observedAt,
    extractedAt: request.extractedAt,
    contentFingerprint: request.fingerprint,
    eventIdentityEvidence: {},
    offers,
    normalizedStatus: 'available',
    statusLabel: '',
    rejectedOffers,
    confidence: 0.5,
  });
  if (regularAdmission) {
    ticketStatus = 'available';
  } else if (offers.some((o) => o.availability === 'available' || o.availability === 'free')) {
    ticketStatus = 'available';
  } else if (offers.length > 0 && offers.every((o) => o.availability === 'sold_out')) {
    ticketStatus = 'sold_out';
  } else if (offer && !Array.isArray(offer)) {
    ticketStatus = mapAvailability(String(offer.availability ?? ''));
  }

  const normalizedStatus = toConsumerNormalizedStatus(ticketStatus) ?? 'available';

  return {
    providerKey: 'fourvenues',
    providerIdentity: identity,
    sourceUrl: request.url.toString(),
    canonicalTicketUrl: request.canonicalTicketUrl,
    sourceObservedAt: request.observedAt,
    extractedAt: request.extractedAt,
    contentFingerprint: request.fingerprint,
    eventIdentityEvidence: {
      rawTitle: event ? String(event.name ?? '').trim() : undefined,
      startAt: event ? String(event.startDate ?? '').trim() : undefined,
      venueName: location ? String(location.name ?? '').trim() : undefined,
    },
    offers,
    normalizedStatus,
    statusLabel: projectStatusLabel(ticketStatus),
    rejectedOffers,
    confidence: offers.length > 0 ? 0.85 : 0.5,
  };
}

export class FourvenuesEvidenceProvider implements TicketEvidenceProvider {
  readonly providerKey = 'fourvenues';

  canHandle(url: URL): boolean {
    return isFourvenuesHost(url.hostname);
  }

  canonicalizeUrl(url: URL): { canonicalUrl: string; isEventDetailUrl: boolean } | null {
    const canonical = canonicalizeFourvenuesUrl(url.toString());
    if (!canonical) {
      return null;
    }
    return {
      canonicalUrl: canonical,
      isEventDetailUrl: isFourvenuesEventDetailUrl(canonical),
    };
  }

  extractProviderIdentity(url: URL): TicketProviderIdentity | null {
    const providerEventId = extractFourvenuesProviderEventId(url.toString());
    if (!providerEventId) {
      return null;
    }
    return buildFourvenuesIdentity(providerEventId, url.hostname);
  }

  async fetchEventEvidence(request: TicketEvidenceRequest): Promise<TicketProviderEventEvidence> {
    const identity = this.extractProviderIdentity(request.url);
    if (!identity) {
      throw new Error('fourvenues_identity_missing');
    }
    const event = extractJsonLdEvents(request.body)[0];
    const tickets = buildEvidence(request, identity, event, request.body);
    const location = event?.location as Record<string, unknown> | undefined;
    return {
      providerKey: 'fourvenues',
      providerIdentity: identity,
      sourceUrl: request.url.toString(),
      canonicalTicketUrl: request.canonicalTicketUrl,
      sourceObservedAt: request.observedAt,
      extractedAt: request.extractedAt,
      contentFingerprint: request.fingerprint,
      event: {
        rawTitle: event ? String(event.name ?? '').trim() : undefined,
        startAt: event ? String(event.startDate ?? '').trim() : undefined,
        venueName: location ? String(location.name ?? '').trim() : undefined,
      },
      tickets,
      confidence: tickets.confidence,
    };
  }
}
