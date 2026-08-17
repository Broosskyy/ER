import { createHash } from 'node:crypto';

import * as cheerio from 'cheerio';

import type {
  EventTicketEvidence,
  TicketEvidenceRequest,
  TicketProviderEventEvidence,
  TicketProviderIdentity,
  VerifiedTicketStatus,
} from './types';
import { buildOrganizerShopIdentity } from './build-provider-identity';
import { classifyTicketOfferRole, isAdmissionOfferRole } from './ticket-offer-role';
import { normalizeTicketPriceLine } from './normalize-ticket-price';
import {
  normalizeTicketStatusFromText,
  toConsumerNormalizedStatus,
} from './normalize-ticket-status';
import { projectStatusLabel } from './ticket-status-badge';
import type { TicketEvidenceProvider } from './types';

function hashPath(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

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

function extractAdmissionFromText(body: string): Array<{ label: string; price: string }> {
  const results: Array<{ label: string; price: string }> = [];
  const patterns = [
    /Vorverkauf\s*\d*\s*(?:\*?\s*Early\s*Bird)?[:\s]+(\d+)\s*Euro/gi,
    /Eintritt[:\s]+(\d+)\s*Euro/gi,
    /ab\s+(\d+[.,]\d{2})\s*€/gi,
    /(\d+[.,]\d{2})\s*€/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
      const price = match[1] ?? '';
      if (price) {
        results.push({ label: 'Admission', price: `${price} EUR` });
      }
    }
  }
  return results;
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
    const availability = normalizeTicketStatusFromText(String(offer.availability ?? 'available')).status;
    if (isAdmissionOfferRole(role)) {
      offers.push({
        rawLabel: label,
        normalizedLabel: label,
        rawPrice,
        amountMinor,
        currency: String(offer.priceCurrency ?? 'EUR'),
        role,
        availability,
        confidence: 0.8,
      });
    }
  }

  for (const entry of extractAdmissionFromText(body)) {
    const normalized = normalizeTicketPriceLine(entry.price);
    if (normalized.amountMinor !== undefined) {
      offers.push({
        rawLabel: entry.label,
        normalizedLabel: entry.label,
        rawPrice: normalized.rawPrice,
        amountMinor: normalized.amountMinor,
        currency: normalized.currency ?? 'EUR',
        role: 'admission',
        availability: 'available',
        confidence: 0.7,
      });
    }
  }

  $('.ticket, .price, [class*="ticket"]').each((_i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const priceMatch = text.match(/(\d+[.,]\d{2})\s*€|(\d+)\s*Euro/i);
    if (!priceMatch) {
      return;
    }
    const normalized = normalizeTicketPriceLine(text);
    if (normalized.amountMinor !== undefined) {
      const role = classifyTicketOfferRole(text);
      if (isAdmissionOfferRole(role)) {
        offers.push({
          rawLabel: text.slice(0, 80),
          normalizedLabel: text.slice(0, 80),
          rawPrice: normalized.rawPrice,
          amountMinor: normalized.amountMinor,
          currency: normalized.currency ?? 'EUR',
          role,
          availability: /sold\s*out|ausverkauft/i.test(text) ? 'sold_out' : 'available',
          confidence: 0.65,
        });
      }
    }
  });

  const location = event?.location as Record<string, unknown> | undefined;
  let ticketStatus: VerifiedTicketStatus = 'unavailable_unknown';
  if (offers.some((o) => o.availability === 'available' || o.availability === 'free')) {
    ticketStatus = 'available';
  } else if (offers.length > 0 && offers.every((o) => o.availability === 'sold_out')) {
    ticketStatus = 'sold_out';
  } else if (/kostenlos|free\s+entry|eintritt\s+frei/i.test(body)) {
    ticketStatus = 'free';
    offers.push({
      rawLabel: 'Free admission',
      normalizedLabel: 'Free admission',
      rawPrice: '0 EUR',
      amountMinor: 0,
      currency: 'EUR',
      role: 'admission',
      availability: 'free',
      confidence: 0.9,
    });
  }

  const normalizedStatus = toConsumerNormalizedStatus(ticketStatus) ?? 'available';

  return {
    providerKey: 'organizer_shop',
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
    confidence: offers.length > 0 ? 0.75 : 0.4,
  };
}

export class OrganizerShopEvidenceProvider implements TicketEvidenceProvider {
  readonly providerKey = 'organizer_shop';

  canHandle(url: URL): boolean {
    return url.protocol === 'https:';
  }

  canonicalizeUrl(url: URL): { canonicalUrl: string; isEventDetailUrl: boolean } | null {
    if (url.protocol !== 'https:') {
      return null;
    }
    const canonical = url.toString();
    return {
      canonicalUrl: canonical,
      isEventDetailUrl: url.pathname.length > 1,
    };
  }

  extractProviderIdentity(url: URL): TicketProviderIdentity | null {
    const path = url.pathname.split('/').filter(Boolean).join('/');
    const providerEventId = path || hashPath(url.toString());
    return buildOrganizerShopIdentity(url.hostname, providerEventId);
  }

  async fetchEventEvidence(request: TicketEvidenceRequest): Promise<TicketProviderEventEvidence> {
    const identity = this.extractProviderIdentity(request.url);
    if (!identity) {
      throw new Error('organizer_shop_identity_missing');
    }
    const event = extractJsonLd(request.body);
    const tickets = buildEvidence(request, identity, event, request.body);
    const location = event?.location as Record<string, unknown> | undefined;
    return {
      providerKey: 'organizer_shop',
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
