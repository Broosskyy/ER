import * as cheerio from 'cheerio';

import type {
  EventTicketEvidence,
  TicketEvidenceRequest,
  TicketProviderEventEvidence,
  TicketProviderIdentity,
  VerifiedTicketStatus,
} from './types';
import { buildFourvenuesIdentity } from './build-provider-identity';
import { classifyTicketOfferRole, isAdmissionOfferRole } from './ticket-offer-role';
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

function extractJsonLd(body: string): Record<string, unknown> | undefined {
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    try {
      const parsed = JSON.parse(match[1] ?? '') as Record<string, unknown>;
      const type = String(parsed['@type'] ?? '');
      if (type.includes('Event') || type.includes('MusicEvent')) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  return undefined;
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

  const offer = event?.offers as Record<string, unknown> | undefined;
  if (offer) {
    const label = String(offer.name ?? 'Admission').trim() || 'Admission';
    const role = classifyTicketOfferRole(label);
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
    if (isAdmissionOfferRole(role)) {
      offers.push({
        rawLabel: label,
        normalizedLabel: label,
        rawPrice,
        amountMinor,
        currency: String(offer.priceCurrency ?? 'EUR'),
        role,
        availability,
        confidence: 0.85,
      });
    } else {
      rejectedOffers.push({ rawLabel: label, rawPrice, reason: 'non_admission_offer' });
    }
  }

  $('.ticket, .ticket-item, [data-ticket], .product-row').each((_i, el) => {
    const label = $(el).find('.name, .title, h3, h4').first().text().replace(/\s+/g, ' ').trim();
    const priceText = $(el).find('.price, .amount').first().text().replace(/\s+/g, ' ').trim();
    if (!label && !priceText) {
      return;
    }
    const role = classifyTicketOfferRole(label);
    const normalized = priceText ? normalizeTicketPriceLine(priceText) : undefined;
    const soldOut = /sold\s*out|ausverkauft/i.test($(el).text());
    const availability = soldOut ? 'sold_out' : 'available';
    if (isAdmissionOfferRole(role)) {
      offers.push({
        rawLabel: label,
        normalizedLabel: label,
        rawPrice: normalized?.rawPrice ?? priceText,
        amountMinor: normalized?.amountMinor,
        currency: normalized?.currency ?? 'EUR',
        role,
        availability,
        confidence: 0.75,
      });
    }
  });

  const location = event?.location as Record<string, unknown> | undefined;
  let ticketStatus: VerifiedTicketStatus = 'unavailable_unknown';
  if (offers.some((o) => o.availability === 'available' || o.availability === 'free')) {
    ticketStatus = 'available';
  } else if (offers.every((o) => o.availability === 'sold_out')) {
    ticketStatus = 'sold_out';
  } else if (offer) {
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
    const event = extractJsonLd(request.body);
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
