import { describe, expect, it } from 'vitest';

import { discoverOfficialTicketCtaFromHtml } from '../discover-official-ticket-cta';
import { enrichResultWithM6_4 } from '../ticket-event-resolution';
import { evaluateTicketLinkNotYetPublished, resolveTicketSourceState } from '../ticket-source-state';

const FUTURE_START = '2026-12-30T21:30:00+01:00';
const PAST_START = '2026-08-15T23:00:00+02:00';

function hiddenTicketCtaHtml(): string {
  return `
    <html><body>
      <a href="" target="_blank" class="element_hidden button secondary fluid">TicketsTickets</a>
    </body></html>
  `;
}

describe('ticket_link_not_yet_published', () => {
  it('accepts future event with hidden ticket CTA and empty href after browser probe', () => {
    const html = hiddenTicketCtaHtml();
    const cta = discoverOfficialTicketCtaFromHtml(html);
    const accepted = evaluateTicketLinkNotYetPublished({
      officialUrl: 'https://club.example/events/future-rave/',
      startsAt: FUTURE_START,
      html,
      discoveredLinks: [],
      rejectedCandidates: [],
      observedAt: '2026-08-17T12:00:00.000Z',
      ctaObservation: cta,
      captureMeta: {
        html,
        sourceEventUrl: 'https://club.example/events/future-rave/',
        observedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'abc',
        ctaProbeAttempted: true,
      },
    });
    expect(accepted).toBe(true);
    const evidence = resolveTicketSourceState({
      officialUrl: 'https://club.example/events/future-rave/',
      startsAt: FUTURE_START,
      html,
      discoveredLinks: [],
      rejectedCandidates: [],
      observedAt: '2026-08-17T12:00:00.000Z',
      ctaObservation: cta,
      captureMeta: {
        html,
        sourceEventUrl: 'https://club.example/events/future-rave/',
        observedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'abc',
        ctaProbeAttempted: true,
      },
    });
    expect(evidence?.state).toBe('ticket_link_not_yet_published');
  });

  it('works for organizer portals with the same DOM pattern', () => {
    const html = `<a class="button secondary fluid element_hidden" href="">Vorverkauf Tickets</a>`;
    const accepted = evaluateTicketLinkNotYetPublished({
      officialUrl: 'https://organizer.example/show/',
      startsAt: FUTURE_START,
      html,
      discoveredLinks: [],
      rejectedCandidates: [],
      observedAt: '2026-08-17T12:00:00.000Z',
      captureMeta: {
        html,
        sourceEventUrl: 'https://organizer.example/show/',
        observedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'fp',
        ctaProbeAttempted: true,
      },
    });
    expect(accepted).toBe(true);
  });

  it('rejects empty CTA without ticket semantics', () => {
    const html = `<a href="" class="button">Mehr Infos</a>`;
    const accepted = evaluateTicketLinkNotYetPublished({
      officialUrl: 'https://club.example/events/info/',
      startsAt: FUTURE_START,
      html,
      discoveredLinks: [],
      rejectedCandidates: [],
      observedAt: '2026-08-17T12:00:00.000Z',
      captureMeta: {
        html,
        sourceEventUrl: 'https://club.example/events/info/',
        observedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'fp',
        ctaProbeAttempted: true,
      },
    });
    expect(accepted).toBe(false);
  });

  it('rejects when a provider URL is already published', () => {
    const html = hiddenTicketCtaHtml();
    const accepted = evaluateTicketLinkNotYetPublished({
      officialUrl: 'https://club.example/events/future-rave/',
      startsAt: FUTURE_START,
      html: `${html}<a href="https://shop.paylogic.com/eda00032b76a4f6c946c688c80a03cf7/">Tickets</a>`,
      discoveredLinks: [
        {
          rawUrl: 'https://shop.paylogic.com/eda00032b76a4f6c946c688c80a03cf7/',
          relation: 'ticket_provider',
          discoveredOnUrl: 'https://club.example/events/future-rave/',
          discoveredFromSource: 'a[href]',
          observedAt: '2026-08-17T12:00:00.000Z',
        },
      ],
      rejectedCandidates: [],
      observedAt: '2026-08-17T12:00:00.000Z',
      captureMeta: {
        html,
        sourceEventUrl: 'https://club.example/events/future-rave/',
        observedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'fp',
        ctaProbeAttempted: true,
      },
    });
    expect(accepted).toBe(false);
  });

  it('rejects for past events', () => {
    const html = hiddenTicketCtaHtml();
    const accepted = evaluateTicketLinkNotYetPublished({
      officialUrl: 'https://club.example/events/past/',
      startsAt: PAST_START,
      endsAt: '2026-08-16T06:00:00+02:00',
      html,
      discoveredLinks: [],
      rejectedCandidates: [],
      observedAt: '2026-08-17T12:00:00.000Z',
      captureMeta: {
        html,
        sourceEventUrl: 'https://club.example/events/past/',
        observedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'fp',
        ctaProbeAttempted: true,
      },
    });
    expect(accepted).toBe(false);
  });

  it('projects honest consumer state without price or purchase CTA', () => {
    const evidence = resolveTicketSourceState({
      officialUrl: 'https://club.example/events/future-rave/',
      startsAt: FUTURE_START,
      html: hiddenTicketCtaHtml(),
      discoveredLinks: [],
      rejectedCandidates: [],
      observedAt: '2026-08-17T12:00:00.000Z',
      captureMeta: {
        html: hiddenTicketCtaHtml(),
        sourceEventUrl: 'https://club.example/events/future-rave/',
        observedAt: '2026-08-17T12:00:00.000Z',
        contentFingerprint: 'fp',
        ctaProbeAttempted: true,
      },
    });
    const enriched = enrichResultWithM6_4(
      {
        sourceEventKey: 'future-rave',
        officialUrl: 'https://club.example/events/future-rave/',
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
    expect(enriched.resolutionClass).toBe('ticket_link_not_yet_published');
    expect(enriched.priceEvidence?.state).toBe('not_yet_published');
    expect(enriched.priceEvidence?.amountMinor).toBeUndefined();
    expect(enriched.consumerPreview?.badge).toBe('Ticketlink noch nicht veröffentlicht');
    expect(enriched.consumerPreview?.actionLabel).toBe('');
  });
});

describe('Into The Madness historical separation', () => {
  it('does not treat VERTILE redirect as Into The Madness current evidence', () => {
    const enriched = enrichResultWithM6_4(
      {
        sourceEventKey: 'into-the-madness-pre-party-weekender-w-ran-d-and-more',
        officialUrl: 'https://bootshaus.tv/events/into-the-madness-pre-party-weekender-w-ran-d-and-more/',
        title: 'Into The Madness Pre-Party Weekender w. RAN - D and more!',
        startsAt: PAST_START,
        discoveredLinks: [
          {
            rawUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
            relation: 'ticket_provider',
            discoveredOnUrl: 'https://bootshaus.tv/events/into-the-madness-pre-party-weekender-w-ran-d-and-more/',
            discoveredFromSource: 'a[href]',
            observedAt: '2026-08-16T19:53:41.518Z',
          },
        ],
        primaryLink: {
          rawUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
          relation: 'ticket_provider',
          discoveredOnUrl: 'https://bootshaus.tv/events/into-the-madness-pre-party-weekender-w-ran-d-and-more/',
          discoveredFromSource: 'a[href]',
          observedAt: '2026-08-16T19:53:41.518Z',
        },
        canonicalTicketUrl: 'https://musical-madness.ticket.io/xYzVert1/',
        providerKey: 'ticket_io',
        identityResult: 'ticket_identity_conflict',
        identityReasons: ['provider_date_mismatch', 'provider_title_mismatch'],
        targetIdentityEvidence: {
          originalUrl: 'https://musical-madness.ticket.io/ebqBfbhC/',
          redirectChain: [
            'https://musical-madness.ticket.io/ebqBfbhC/',
            'https://musical-madness.ticket.io/xYzVert1/',
          ],
          terminalUrl: 'https://musical-madness.ticket.io/xYzVert1/',
          providerKey: 'ticket_io',
          providerEventId: 'xYzVert1',
          terminalTitle: 'VERTILE',
          terminalStartAt: '2026-09-20T22:00:00+02:00',
          observedAt: '2026-08-16T19:53:41.518Z',
          contentFingerprint: 'fixture',
          identityDecision: 'redirected_to_different_event',
          reasons: ['provider_date_mismatch', 'provider_title_mismatch'],
        },
        classification: 'ticket_identity_conflict',
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
          contentFingerprint: 'f921c4318cefeacdcde87196f1e8f404c1f26ae7128fecf11016bb2a7b8ca454',
        },
      },
    );
    expect(enriched.resolutionClass).toBe('verified_sales_ended');
    expect(enriched.identityResult).toBe('ticket_identity_conflict');
    expect(enriched.priceEvidence?.state).not.toBe('verified_historical');
    expect(enriched.consumerPreview?.actionLabel).toBe('');
    expect(enriched.resolvedAction?.kind).toBe('historical_ticket_detail');
  });
});
