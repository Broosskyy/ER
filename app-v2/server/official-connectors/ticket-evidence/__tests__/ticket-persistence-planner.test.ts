import { describe, expect, it } from 'vitest';

import { enrichResultWithM6_4 } from '../ticket-event-resolution';
import {
  planTicketEvidencePersistence,
  summarizeTicketPersistencePlan,
} from '../ticket-persistence-planner';
import type {
  ExistingOfficialEventBinding,
  ExistingEventTicketRecord,
  ExistingTicketSourceRecord,
} from '../ticket-persistence-types';
import { resolveTicketSourceState } from '../ticket-source-state';

const OFFICIAL_URL = 'https://club.example/events/future-rave/';
const FUTURE_START = '2026-12-30T21:30:00+01:00';

function buildBinding(eventId = 'event-1'): ExistingOfficialEventBinding {
  return {
    eventId,
    officialUrl: OFFICIAL_URL,
    sourceId: 'source-1',
    contentHash: 'fp-official',
    rawPayload: { connectorId: 'bootshaus-official' },
    title: 'Future Rave',
  };
}

describe('ticket persistence planning', () => {
  it('does not plan ticket rows for ticket_link_not_yet_published', () => {
    const evidence = resolveTicketSourceState({
      officialUrl: OFFICIAL_URL,
      startsAt: FUTURE_START,
      html: '<a href="" class="button secondary fluid element_hidden">TicketsTickets</a>',
      discoveredLinks: [],
      rejectedCandidates: [],
      observedAt: '2026-08-17T12:00:00.000Z',
      captureMeta: {
        html: '<a href="" class="button secondary fluid element_hidden">TicketsTickets</a>',
        sourceEventUrl: OFFICIAL_URL,
        observedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'fp',
        ctaProbeAttempted: true,
      },
    });
    const result = enrichResultWithM6_4(
      {
        sourceEventKey: 'future-rave',
        officialUrl: OFFICIAL_URL,
        title: 'Future Rave',
        startsAt: FUTURE_START,
        discoveredLinks: [],
        rejectedCandidates: [],
        identityResult: 'ticket_identity_unverifiable',
        identityReasons: [],
        classification: 'ticket_link_not_yet_published',
        verifiedTicketComplete: false,
      },
      { ticketSourceStateEvidence: evidence },
    );
    const plans = planTicketEvidencePersistence([result], {
      officialBindings: [buildBinding()],
      existingTickets: [],
      existingTicketSources: [],
    });
    const summary = summarizeTicketPersistencePlan(plans);
    expect(summary.ticketLinkNotYetPublishedStates).toBe(1);
    expect(summary.currentTicketInsertsRequired).toBe(0);
    expect(plans[0]?.ticketOperation).toBe('noop');
    expect(plans[0]?.consumerProjection.hasActivePurchaseCta).toBe(false);
    expect(plans[0]?.provenanceOperation).toBe('update');
  });

  it('plans current ticket insert for verified complete evidence', () => {
    const result = enrichResultWithM6_4({
      sourceEventKey: 'loonyland',
      officialUrl: 'https://bootshaus.tv/events/loonyland/',
      title: 'Loonyland',
      startsAt: '2026-08-21T22:00:00+02:00',
      discoveredLinks: [],
      rejectedCandidates: [],
      primaryLink: {
        rawUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        relation: 'ticket_provider',
        discoveredOnUrl: 'https://bootshaus.tv/events/loonyland/',
        discoveredFromSource: 'a[href]',
        observedAt: '2026-08-17T12:00:00.000Z',
      },
      canonicalTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      providerKey: 'ticket_io',
      identityResult: 'ticket_identity_verified',
      identityReasons: [],
      classification: 'verified_ticket_complete',
      verifiedTicketComplete: true,
      ticketEvidence: {
        providerKey: 'ticket_io',
        providerIdentity: {
          providerKey: 'ticket_io',
          providerEventId: 'tA3dBrv7',
          providerScope: 'bootshaus-club.ticket.io',
          identityKey: 'ticket_io:bootshaus-club.ticket.io:tA3dBrv7',
        },
        sourceUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        canonicalTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        sourceObservedAt: '2026-08-17T12:00:00.000Z',
        extractedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'fp-provider',
        offers: [
          {
            rawLabel: 'Admission',
            normalizedLabel: 'Admission',
            rawPrice: 'ab 25,90 EUR',
            amountMinor: 2590,
            currency: 'EUR',
            role: 'admission',
            availability: 'available',
            confidence: 0.9,
          },
        ],
        normalizedStatus: 'available',
        statusLabel: 'Tickets verfügbar',
        rejectedOffers: [],
        confidence: 0.9,
      },
    });
    const plans = planTicketEvidencePersistence([result], {
      officialBindings: [
        {
          eventId: 'event-loonyland',
          officialUrl: 'https://bootshaus.tv/events/loonyland/',
          sourceId: 'source-loonyland',
          contentHash: 'fp',
          rawPayload: {},
          title: 'Loonyland',
        },
      ],
      existingTickets: [],
      existingTicketSources: [],
    });
    const summary = summarizeTicketPersistencePlan(plans);
    expect(summary.currentTicketInsertsRequired).toBe(1);
    expect(plans[0]?.plannedTicketRow?.ticketUrl).toBe('https://bootshaus-club.ticket.io/tA3dBrv7/');
    expect(plans[0]?.plannedTicketRow?.priceFromMinor).toBe(2590);
    expect(plans[0]?.providerSourceOperation).toBe('insert');
  });

  it('marks historical tickets as sales_ended without active purchase CTA', () => {
    const result = enrichResultWithM6_4(
      {
        sourceEventKey: 'into-the-madness',
        officialUrl: 'https://bootshaus.tv/events/into-the-madness/',
        title: 'Into The Madness',
        startsAt: '2026-08-15T23:00:00+02:00',
        discoveredLinks: [],
        rejectedCandidates: [],
        primaryLink: {
          rawUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
          relation: 'ticket_provider',
          discoveredOnUrl: 'https://bootshaus.tv/events/into-the-madness/',
          discoveredFromSource: 'a[href]',
          observedAt: '2026-08-16T19:53:41.518Z',
        },
        canonicalTicketUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
        providerKey: 'ticket_io',
        identityResult: 'ticket_identity_verified',
        identityReasons: [],
        classification: 'verified_sales_ended',
        verifiedTicketComplete: false,
      },
      {
        officialEndsAt: '2026-08-16T06:00:00+02:00',
        historicalCapture: {
          amountMinor: 3400,
          currency: 'EUR',
          rawPriceText: 'ab 34,9 EUR',
          sourceUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
          sourceObservedAt: '2026-08-16T19:53:41.518Z',
          contentFingerprint: 'fp-hist',
        },
      },
    );
    const plans = planTicketEvidencePersistence([result], {
      officialBindings: [
        {
          eventId: 'event-madness',
          officialUrl: 'https://bootshaus.tv/events/into-the-madness/',
          sourceId: 'source-madness',
          contentHash: 'fp',
          rawPayload: {},
          title: 'Into The Madness',
        },
      ],
      existingTickets: [],
      existingTicketSources: [],
    });
    expect(plans[0]?.plannedTicketRow?.salesStatus).toBe('sales_ended');
    expect(plans[0]?.consumerProjection.hasActivePurchaseCta).toBe(false);
    expect(plans[0]?.ticketOperation).toBe('insert');
  });

  it('is idempotent when DB already matches the plan', () => {
    const result = enrichResultWithM6_4({
      sourceEventKey: 'loonyland',
      officialUrl: 'https://bootshaus.tv/events/loonyland/',
      title: 'Loonyland',
      startsAt: '2026-08-21T22:00:00+02:00',
      discoveredLinks: [],
      rejectedCandidates: [],
      primaryLink: {
        rawUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        relation: 'ticket_provider',
        discoveredOnUrl: 'https://bootshaus.tv/events/loonyland/',
        discoveredFromSource: 'a[href]',
        observedAt: '2026-08-17T12:00:00.000Z',
      },
      canonicalTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      providerKey: 'ticket_io',
      identityResult: 'ticket_identity_verified',
      identityReasons: [],
      classification: 'verified_ticket_complete',
      verifiedTicketComplete: true,
      ticketEvidence: {
        providerKey: 'ticket_io',
        providerIdentity: {
          providerKey: 'ticket_io',
          providerEventId: 'tA3dBrv7',
          providerScope: 'bootshaus-club.ticket.io',
          identityKey: 'ticket_io:bootshaus-club.ticket.io:tA3dBrv7',
        },
        sourceUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        canonicalTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        sourceObservedAt: '2026-08-17T12:00:00.000Z',
        extractedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'fp-provider',
        offers: [
          {
            rawLabel: 'Admission',
            normalizedLabel: 'Admission',
            rawPrice: 'ab 25,90 EUR',
            amountMinor: 2590,
            currency: 'EUR',
            role: 'admission',
            availability: 'available',
            confidence: 0.9,
          },
        ],
        normalizedStatus: 'available',
        statusLabel: 'Tickets verfügbar',
        rejectedOffers: [],
        confidence: 0.9,
      },
    });
    const binding = {
      eventId: 'event-loonyland',
      officialUrl: 'https://bootshaus.tv/events/loonyland/',
      sourceId: 'source-loonyland',
      contentHash: 'fp',
      rawPayload: {
        ticketEvidenceProjection: {
          ticketSourceState: 'current_ticket_detail',
          resolutionClass: 'verified_ticket_complete',
          consumerProjection: {
            ticketSourceState: 'current_ticket_detail',
            providerKey: 'ticket_io',
            priceLabel: 'ab 25,90 €',
            priceEvidenceState: 'verified_current',
            status: 'available',
            badge: 'Tickets verfügbar',
            actionKind: 'ticket_detail',
            actionLabel: 'Tickets kaufen',
            canonicalTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
            hasActivePurchaseCta: true,
          },
        },
      },
      title: 'Loonyland',
    };
    const existingTickets: ExistingEventTicketRecord[] = [
      {
        ticketId: 'ticket-1',
        eventId: 'event-loonyland',
        provider: 'ticket_io',
        ticketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        priceFromMinor: 2590,
        currency: 'EUR',
        salesStatus: 'available',
        sortOrder: 0,
      },
    ];
    const existingTicketSources: ExistingTicketSourceRecord[] = [
      {
        sourceId: 'ticket-source-1',
        eventId: 'event-loonyland',
        sourceUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        contentHash: 'fp-provider',
        rawPayload: {
          providerKey: 'ticket_io',
          contentFingerprint: 'fp-provider',
          canonicalTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        },
      },
    ];
    const plans = planTicketEvidencePersistence([result], {
      officialBindings: [binding],
      existingTickets,
      existingTicketSources,
    });
    const summary = summarizeTicketPersistencePlan(plans);
    expect(summary.currentTicketInsertsRequired).toBe(0);
    expect(summary.currentTicketUpdatesRequired).toBe(0);
    expect(plans[0]?.ticketOperation).toBe('noop');
    expect(plans[0]?.providerSourceOperation).toBe('noop');
  });
});
