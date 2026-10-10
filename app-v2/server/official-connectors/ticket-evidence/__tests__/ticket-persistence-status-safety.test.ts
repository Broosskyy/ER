import { describe, expect, it } from 'vitest';

import { hasVerifiedEventSpecificTicketTarget } from '../consumer-ticket-safety-gate';
import type { VerifiedTicketCompleteResult } from '../ticket-audit-metrics';
import { planTicketEvidencePersistence } from '../ticket-persistence-planner';

const OFFICIAL_URL = 'https://organizer.example/events/future-rave/';
const TICKET_URL = 'https://tickets.example.com/events/future-rave';
const OBSERVED_AT = '2026-10-10T16:00:00.000Z';

function buildResult(): VerifiedTicketCompleteResult {
  return {
    sourceEventKey: 'future-rave',
    officialUrl: OFFICIAL_URL,
    title: 'Future Rave',
    startsAt: '2026-12-30T22:00:00+01:00',
    discoveredLinks: [],
    rejectedCandidates: [],
    canonicalTicketUrl: TICKET_URL,
    providerKey: 'organizer_shop',
    identityResult: 'ticket_identity_verified',
    identityReasons: [],
    targetIdentityEvidence: {
      originalUrl: TICKET_URL,
      redirectChain: [TICKET_URL],
      terminalUrl: TICKET_URL,
      providerKey: 'organizer_shop',
      observedAt: OBSERVED_AT,
      contentFingerprint: 'fp-target',
      identityDecision: 'verified_same_event',
      reasons: [],
    },
    classification: 'ticket_evidence_missing',
    verifiedTicketComplete: false,
    ticketSourceStateEvidence: {
      state: 'current_ticket_detail',
      sourceEventUrl: OFFICIAL_URL,
      observedAt: OBSERVED_AT,
      contentFingerprint: 'fp-official',
      ctaObserved: true,
      ctaText: 'Tickets',
      ctaVisible: true,
      rawHref: TICKET_URL,
      resolvedUrl: TICKET_URL,
      canonicalTicketUrl: TICKET_URL,
      providerKey: 'organizer_shop',
      evidenceOrigin: 'official_source_dom',
    },
    statusProjection: {
      availabilityStatus: 'availability_unverified',
      normalizedStatus: 'available',
      statusLabel: 'Status unbekannt',
      statusEvidenceOrigin: 'unavailable',
    },
  };
}

describe('ticket persistence status safety', () => {
  it('persists a verified event-specific URL without inventing availability', () => {
    const result = buildResult();
    const plans = planTicketEvidencePersistence([result], {
      officialBindings: [
        {
          eventId: 'event-1',
          officialUrl: OFFICIAL_URL,
          sourceId: 'source-1',
          contentHash: 'fp-official',
          rawPayload: {},
          title: 'Future Rave',
        },
      ],
      existingTickets: [],
      existingTicketSources: [],
    });

    expect(plans[0]?.ticketOperation).toBe('insert');
    expect(plans[0]?.plannedTicketRow?.ticketUrl).toBe(TICKET_URL);
    expect(plans[0]?.plannedTicketRow?.salesStatus).toBe('availability_unverified');
    expect(plans[0]?.plannedTicketRow?.priceFromMinor).toBeUndefined();
    expect(plans[0]?.consumerProjection.hasActivePurchaseCta).toBe(false);
  });

  it('keeps an evidence-backed available status available', () => {
    const result = buildResult();
    result.ticketEvidence = {
      providerKey: 'organizer_shop',
      providerIdentity: {
        providerKey: 'organizer_shop',
        providerEventId: 'future-rave',
        providerScope: 'tickets.example.com',
        identityKey: 'organizer_shop:tickets.example.com:future-rave',
      },
      sourceUrl: TICKET_URL,
      canonicalTicketUrl: TICKET_URL,
      sourceObservedAt: OBSERVED_AT,
      extractedAt: OBSERVED_AT,
      contentFingerprint: 'fp-provider',
      eventIdentityEvidence: {
        rawTitle: 'Future Rave',
        normalizedTitle: 'future rave',
        startAt: '2026-12-30T22:00:00+01:00',
      },
      offers: [],
      normalizedStatus: 'available',
      statusLabel: 'Tickets verfügbar',
      rejectedOffers: [],
      confidence: 0.9,
    };

    const plans = planTicketEvidencePersistence([result], {
      officialBindings: [
        {
          eventId: 'event-1',
          officialUrl: OFFICIAL_URL,
          sourceId: 'source-1',
          contentHash: 'fp-official',
          rawPayload: {},
          title: 'Future Rave',
        },
      ],
      existingTickets: [],
      existingTicketSources: [],
    });

    expect(plans[0]?.plannedTicketRow?.salesStatus).toBe('available');
  });

  it('rejects a bare organizer homepage as an event-specific ticket target', () => {
    expect(
      hasVerifiedEventSpecificTicketTarget({
        identityResult: 'ticket_identity_verified',
        identityDecision: 'verified_same_event',
        canonicalTicketUrl: 'https://www.hardshift.de/',
      }),
    ).toBe(false);

    expect(
      hasVerifiedEventSpecificTicketTarget({
        identityResult: 'ticket_identity_verified',
        identityDecision: 'verified_same_event',
        canonicalTicketUrl: 'https://tickets.example.com/events/future-rave',
      }),
    ).toBe(true);
  });
});
