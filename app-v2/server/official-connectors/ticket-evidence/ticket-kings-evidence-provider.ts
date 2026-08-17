import type {
  EventTicketEvidence,
  TicketEvidenceRequest,
  TicketProviderEventEvidence,
  TicketProviderIdentity,
  VerifiedTicketStatus,
} from './types';
import { buildTicketKingsIdentity } from './build-provider-identity';
import { classifyTicketOfferRole, isAdmissionOfferRole } from './ticket-offer-role';
import { normalizeTicketPriceLine } from './normalize-ticket-price';
import {
  normalizeTicketStatusFromText,
  toConsumerNormalizedStatus,
} from './normalize-ticket-status';
import { projectStatusLabel } from './ticket-status-badge';
import { isTicketKingsHost } from './url-policy';
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

function buildEvidence(
  request: TicketEvidenceRequest,
  identity: TicketProviderIdentity,
  event: Record<string, unknown> | undefined,
): EventTicketEvidence {
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
        confidence: 0.85,
      });
    } else {
      rejectedOffers.push({ rawLabel: label, rawPrice, reason: 'non_admission_offer' });
    }
  }

  const location = event?.location as Record<string, unknown> | undefined;
  let ticketStatus: VerifiedTicketStatus = 'unavailable_unknown';
  if (offers.some((o) => o.availability === 'available' || o.availability === 'free')) {
    ticketStatus = 'available';
  } else if (offers.length > 0 && offers.every((o) => o.availability === 'sold_out')) {
    ticketStatus = 'sold_out';
  }

  const normalizedStatus = toConsumerNormalizedStatus(ticketStatus) ?? 'available';

  return {
    providerKey: 'ticket_kings',
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

export class TicketKingsEvidenceProvider implements TicketEvidenceProvider {
  readonly providerKey = 'ticket_kings';

  canHandle(url: URL): boolean {
    return isTicketKingsHost(url.hostname);
  }

  canonicalizeUrl(url: URL): { canonicalUrl: string; isEventDetailUrl: boolean } | null {
    if (url.protocol !== 'https:' || !this.canHandle(url)) {
      return null;
    }
    const parsed = new URL(url.toString());
    parsed.hash = '';
    const segments = parsed.pathname.split('/').filter(Boolean);
    return {
      canonicalUrl: parsed.toString(),
      isEventDetailUrl: segments.length >= 1,
    };
  }

  extractProviderIdentity(url: URL): TicketProviderIdentity | null {
    const segments = url.pathname.split('/').filter(Boolean);
    const providerEventId = segments[segments.length - 1] || segments[0];
    if (!providerEventId) {
      return null;
    }
    return buildTicketKingsIdentity(url.hostname, providerEventId);
  }

  async fetchEventEvidence(request: TicketEvidenceRequest): Promise<TicketProviderEventEvidence> {
    const identity = this.extractProviderIdentity(request.url);
    if (!identity) {
      throw new Error('ticket_kings_identity_missing');
    }
    const event = extractJsonLd(request.body);
    const tickets = buildEvidence(request, identity, event);
    const location = event?.location as Record<string, unknown> | undefined;
    return {
      providerKey: 'ticket_kings',
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
