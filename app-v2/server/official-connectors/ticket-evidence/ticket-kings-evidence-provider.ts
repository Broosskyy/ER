import type {
  EventTicketEvidence,
  TicketEvidenceRequest,
  TicketProviderEventEvidence,
  TicketProviderIdentity,
  VerifiedTicketStatus,
} from './types';
import { buildTicketKingsIdentity } from './build-provider-identity';
import { classifyTicketOfferRole, isAdmissionOfferRole } from './ticket-offer-role';
import {
  normalizeTicketStatusFromText,
  toConsumerNormalizedStatus,
} from './normalize-ticket-status';
import { projectStatusLabel } from './ticket-status-badge';
import { isTicketKingsHost } from './url-policy';
import type { TicketEvidenceProvider } from './types';
import { fetchTicketPage } from './fetch-ticket-page';
import {
  enrichTicketKingsDomWithEmbeds,
  parseTicketKingsDetailDom,
} from './parse-ticket-kings-detail-dom';

function buildEvidenceFromDom(
  request: TicketEvidenceRequest,
  identity: TicketProviderIdentity,
  domEvidence: ReturnType<typeof parseTicketKingsDetailDom>,
): EventTicketEvidence {
  const offers: EventTicketEvidence['offers'] = [];
  const rejectedOffers: EventTicketEvidence['rejectedOffers'] = [...domEvidence.rejectedOffers];

  for (const offer of domEvidence.offers) {
    const label = offer.phaseLabel ? `${offer.rawLabel} ${offer.phaseLabel}` : offer.rawLabel;
    const role = classifyTicketOfferRole(label);
    const availability: VerifiedTicketStatus = offer.soldOut
      ? 'sold_out'
      : offer.purchasable
        ? 'available'
        : normalizeTicketStatusFromText('available').status;
    if (isAdmissionOfferRole(role)) {
      offers.push({
        rawLabel: label,
        normalizedLabel: offer.rawLabel,
        rawPrice: offer.rawPrice,
        amountMinor: offer.amountMinor,
        currency: offer.currency ?? 'EUR',
        role,
        availability,
        confidence: offer.purchasable ? 0.9 : 0.75,
      });
    } else {
      rejectedOffers.push({ rawLabel: label, rawPrice: offer.rawPrice, reason: 'non_admission_offer' });
    }
  }

  let ticketStatus: VerifiedTicketStatus = domEvidence.ticketStatus;
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
    contentFingerprint: domEvidence.contentFingerprint || request.fingerprint,
    eventIdentityEvidence: {
      rawTitle: domEvidence.eventTitle,
      startAt: domEvidence.startAt,
      venueName: domEvidence.venueName,
    },
    offers,
    normalizedStatus,
    statusLabel: projectStatusLabel(ticketStatus),
    rejectedOffers,
    confidence: offers.length > 0 ? 0.9 : 0.55,
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
      isEventDetailUrl:
        segments.length >= 1 && (segments[0] === 'event' || segments[0] === 'events'),
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

    const domEvidence = parseTicketKingsDetailDom(request.body, request.canonicalTicketUrl);
    const enrichedDom = await enrichTicketKingsDomWithEmbeds(domEvidence, async (embedUrl) => {
      const result = await fetchTicketPage(embedUrl);
      return { body: result.body, blocked: result.blocked };
    });
    const tickets = buildEvidenceFromDom(request, identity, enrichedDom);

    return {
      providerKey: 'ticket_kings',
      providerIdentity: identity,
      sourceUrl: request.url.toString(),
      canonicalTicketUrl: request.canonicalTicketUrl,
      sourceObservedAt: request.observedAt,
      extractedAt: request.extractedAt,
      contentFingerprint: enrichedDom.contentFingerprint || request.fingerprint,
      event: {
        rawTitle: enrichedDom.eventTitle,
        startAt: enrichedDom.startAt,
        venueName: enrichedDom.venueName,
        description: enrichedDom.descriptionClean,
        imageUrl: enrichedDom.imageUrl,
      },
      tickets,
      confidence: tickets.confidence,
      supplementalContent: enrichedDom.descriptionClean
        ? {
            descriptionClean: enrichedDom.descriptionClean,
            lineupCandidates: enrichedDom.lineupCandidates,
          }
        : undefined,
    };
  }
}
