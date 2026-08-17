import { createHash } from 'node:crypto';

import type {
  EventTicketEvidence,
  TicketEvidenceRequest,
  TicketProviderEventEvidence,
  TicketProviderIdentity,
} from './types';
import { buildTicketIoIdentity } from './build-provider-identity';
import { parseTicketIoDetailDom, type TicketIoDetailDomEvidence } from './parse-ticket-io-detail-dom';
import { classifyTicketOfferRole, isAdmissionOfferRole } from './ticket-offer-role';
import { normalizeTicketPriceLine } from './normalize-ticket-price';
import {
  classificationForStatus,
  normalizeTicketStatusFromText,
  toConsumerNormalizedStatus,
} from './normalize-ticket-status';
import { projectStatusLabel } from './ticket-status-badge';
import { isTicketProviderBlockedBody } from './safe-fetch-ticket';
import {
  canonicalizeTicketIoUrl,
  extractTicketIoProviderEventId,
  isTicketIoEventDetailUrl,
  isTicketIoHost,
} from './url-policy';
import type { TicketEvidenceProvider } from './types';

function hashFallbackId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function buildEventTicketEvidence(
  request: TicketEvidenceRequest,
  identity: TicketProviderIdentity,
  domEvidence: TicketIoDetailDomEvidence,
): EventTicketEvidence {
  const offers = domEvidence.offers
    .filter((offer) => isAdmissionOfferRole(offer.role))
    .map((offer) => {
    const role = classifyTicketOfferRole(offer.rawLabel);
    const availability: import('./types').VerifiedTicketStatus = offer.soldOut
      ? 'sold_out'
      : offer.purchasable
        ? 'available'
        : normalizeTicketStatusFromText('available').status;
    return {
      rawLabel: offer.rawLabel,
      normalizedLabel: offer.rawLabel,
      rawPrice: offer.rawPrice,
      amountMinor: offer.amountMinor,
      currency: offer.currency,
      role,
      availability,
      confidence: offer.purchasable ? 0.9 : 0.75,
    };
  });

  const normalizedStatus =
    toConsumerNormalizedStatus(domEvidence.ticketStatus) ??
    (domEvidence.ticketStatus === 'sold_out' ? 'sold_out' : 'available');
  return {
    providerKey: 'ticket_io',
    providerIdentity: identity,
    sourceUrl: request.url.toString(),
    canonicalTicketUrl: request.canonicalTicketUrl,
    sourceObservedAt: request.observedAt,
    extractedAt: request.extractedAt,
    contentFingerprint: request.fingerprint,
    eventIdentityEvidence: {
      rawTitle: domEvidence.eventTitle,
      startAt: domEvidence.startAt,
      venueName: domEvidence.venueName,
    },
    offers,
    normalizedStatus,
    statusLabel: projectStatusLabel(domEvidence.ticketStatus),
    rejectedOffers: domEvidence.rejectedOffers.map((offer) => ({
      rawLabel: offer.rawLabel,
      reason: offer.reason,
    })),
    confidence: offers.length > 0 ? 0.9 : 0.6,
  };
}

export class TicketIoEvidenceProvider implements TicketEvidenceProvider {
  readonly providerKey = 'ticket_io';

  canHandle(url: URL): boolean {
    return isTicketIoHost(url.hostname);
  }

  canonicalizeUrl(url: URL): { canonicalUrl: string; isEventDetailUrl: boolean } | null {
    const canonical = canonicalizeTicketIoUrl(url.toString());
    if (!canonical) {
      return null;
    }
    return {
      canonicalUrl: canonical,
      isEventDetailUrl: isTicketIoEventDetailUrl(canonical),
    };
  }

  extractProviderIdentity(url: URL): TicketProviderIdentity | null {
    const providerEventId = extractTicketIoProviderEventId(url.toString());
    if (!providerEventId) {
      return null;
    }
    return buildTicketIoIdentity(url.hostname, providerEventId);
  }

  async fetchEventEvidence(request: TicketEvidenceRequest): Promise<TicketProviderEventEvidence> {
    const identity =
      this.extractProviderIdentity(new URL(request.canonicalTicketUrl)) ??
      this.extractProviderIdentity(request.url);
    if (!identity) {
      throw new Error('ticket_io_identity_missing');
    }

    const domEvidence = parseTicketIoDetailDom(request.body, {
      sourceUrl: request.canonicalTicketUrl,
      providerEventId: identity.providerEventId,
      shopHost: new URL(request.canonicalTicketUrl).hostname,
    });
    if (!domEvidence) {
      const minimalStatus = isTicketProviderBlockedBody(request.body, request.contentType)
        ? 'ticket_provider_blocked'
        : 'ticket_status_ambiguous';
      const emptyTickets: EventTicketEvidence = {
        providerKey: 'ticket_io',
        providerIdentity: identity,
        sourceUrl: request.url.toString(),
        canonicalTicketUrl: request.canonicalTicketUrl,
        sourceObservedAt: request.observedAt,
        extractedAt: request.extractedAt,
        contentFingerprint: request.fingerprint,
        eventIdentityEvidence: {},
        offers: [],
        normalizedStatus: 'available',
        statusLabel: 'Tickets verfügbar',
        rejectedOffers: [{ reason: minimalStatus }],
        confidence: 0.1,
      };
      return {
        providerKey: 'ticket_io',
        providerIdentity: identity,
        sourceUrl: request.url.toString(),
        canonicalTicketUrl: request.canonicalTicketUrl,
        sourceObservedAt: request.observedAt,
        extractedAt: request.extractedAt,
        contentFingerprint: request.fingerprint,
        event: {},
        tickets: emptyTickets,
        confidence: 0.1,
      };
    }
    const tickets = buildEventTicketEvidence(request, identity, domEvidence);

    return {
      providerKey: 'ticket_io',
      providerIdentity: identity,
      sourceUrl: request.url.toString(),
      canonicalTicketUrl: request.canonicalTicketUrl,
      sourceObservedAt: request.observedAt,
      extractedAt: request.extractedAt,
      contentFingerprint: request.fingerprint,
      event: {
        rawTitle: domEvidence.eventTitle,
        startAt: domEvidence.startAt,
        venueName: domEvidence.venueName,
      },
      tickets,
      confidence: tickets.confidence,
    };
  }
}

export function parseTicketIoFromJsonLdOrDom(input: {
  sourceUrl: string;
  body: string;
  fingerprint: string;
  observedAt: string;
  extractedAt: string;
}): EventTicketEvidence | undefined {
  const canonicalTicketUrl = canonicalizeTicketIoUrl(input.sourceUrl);
  if (!canonicalTicketUrl || !isTicketIoEventDetailUrl(canonicalTicketUrl)) {
    return undefined;
  }

  const providerEventId = extractTicketIoProviderEventId(canonicalTicketUrl);
  if (!providerEventId) {
    return undefined;
  }

  const hostname = new URL(canonicalTicketUrl).hostname;
  const identity = buildTicketIoIdentity(hostname, providerEventId);
  const domEvidence = parseTicketIoDetailDom(input.body, { sourceUrl: canonicalTicketUrl });
  if (!domEvidence) {
    return undefined;
  }

  const request: TicketEvidenceRequest = {
    url: new URL(canonicalTicketUrl),
    canonicalTicketUrl,
    redirectChain: [canonicalTicketUrl],
    body: input.body,
    contentType: 'text/html',
    fingerprint: input.fingerprint,
    observedAt: input.observedAt,
    extractedAt: input.extractedAt,
  };

  return buildEventTicketEvidence(request, identity, domEvidence);
}

export function lowestAdmissionOffer(evidence: EventTicketEvidence) {
  const admission = evidence.offers.filter((offer) => isAdmissionOfferRole(offer.role ?? 'unknown_addon'));
  const priced = admission.filter((offer) => offer.amountMinor !== undefined);
  const available = priced.filter(
    (offer) => offer.availability === 'available' || offer.availability === 'free',
  );
  const pool = available.length > 0 ? available : priced.filter((offer) => offer.availability === 'sold_out');
  return pool.sort(
    (left, right) => (left.amountMinor ?? Number.MAX_SAFE_INTEGER) - (right.amountMinor ?? Number.MAX_SAFE_INTEGER),
  )[0];
}

export { classificationForStatus };
