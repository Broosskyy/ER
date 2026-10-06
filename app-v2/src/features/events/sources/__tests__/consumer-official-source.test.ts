import { describe, expect, it } from 'vitest';

import { resolveConsumerOfficialSource } from '../consumer-official-source';

const officialPage = 'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie/';

describe('consumer official source roles', () => {
  it('keeps official event url when tickets are missing', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: officialPage,
      organizerName: 'BOOTSHAUS',
      imageUrl: 'https://cdn.example.com/flyer.png',
      ticket: null,
    });

    expect(projection.officialEventUrl).toBe(officialPage);
    expect(projection.eventSourceUrl).toBe(officialPage);
    expect(projection.ticketUrl).toBeUndefined();
    expect(projection.sourceImageUrl).toBe('https://cdn.example.com/flyer.png');
    expect(projection.officialSourceMissing).toBe(false);
    expect(projection.sourceLabel).toBe('Offizielle Eventseite von Bootshaus');
    expect(projection.visibleLinks).toEqual([
      {
        role: 'official_event',
        label: 'Offizielle Eventseite von Bootshaus',
        url: officialPage,
      },
    ]);
    expect(projection.organizerWebsiteUrl).toBeUndefined();
    expect(projection.organizerLinks.some((link) => link.role === 'organizer_website')).toBe(false);
  });

  it('does not copy the event source origin onto a foreign organizer', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: 'https://bootshaus.tv/events/blacklist-inurfase-pres-zaagstep-by-dr-donk/',
      organizerName: 'INURFASE',
      ticket: null,
    });

    expect(projection.sourceLabel).toBe('Offizielle Eventseite von Bootshaus');
    expect(projection.organizerWebsiteUrl).toBeUndefined();
    expect(projection.organizerLinks).toEqual([]);
  });

  it('renders an organizer website only when it is verified for that organizer', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: officialPage,
      organizerName: 'BOOTSHAUS',
      verifiedOrganizerWebsiteUrl: 'https://bootshaus.tv/',
    });

    expect(projection.organizerWebsiteUrl).toBe('https://bootshaus.tv/');
    expect(projection.organizerLinks).toEqual([
      {
        role: 'organizer_website',
        label: 'Website',
        url: 'https://bootshaus.tv/',
      },
    ]);
  });

  it('never uses a ticket provider url as official event source', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      organizerName: 'BOOTSHAUS',
      ticket: {
        id: 't1',
        provider: 'ticket_io',
        ticketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        priceFromMinor: null,
        currency: 'EUR',
        salesStatus: 'available',
        sortOrder: 0,
      },
    });

    expect(projection.officialEventUrl).toBeUndefined();
    expect(projection.officialSourceMissing).toBe(true);
    expect(projection.officialSourceMissingReason).toBe('ticket_url_used_as_official_source');
    expect(projection.visibleLinks.some((link) => link.role === 'official_event')).toBe(false);
  });

  it('rejects generic homepages and does not fall back to venue urls', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: 'https://bootshaus.tv/',
      organizerName: 'BOOTSHAUS',
      venueOfficialUrl: 'https://bootshaus.tv/',
      ticket: null,
    });

    expect(projection.officialEventUrl).toBeUndefined();
    expect(projection.officialSourceMissingReason).toBe('generic_homepage');
    expect(projection.visibleLinks).toEqual([]);
  });

  it('keeps ticket urls out of content sources', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: 'https://bootshaus.tv/events/chris-stussy-pres-by-bootshaus/',
      organizerName: 'BOOTSHAUS',
      purchaseTicketUrl: 'https://bootshaus-club.ticket.io/By06xnf4/',
    });

    expect(projection.visibleLinks.map((link) => link.role)).toEqual(['official_event']);
    expect(projection.ticketUrl).toBe('https://bootshaus-club.ticket.io/By06xnf4/');
    expect(projection.officialEventUrl).not.toBe(projection.ticketUrl);
    expect(projection.visibleLinks.some((link) => link.url === projection.ticketUrl)).toBe(false);
  });
});

describe('consumer social source roles', () => {
  const permalink = 'https://www.instagram.com/bootshaus/p/AbCdEfGhIjK/';

  it('rejects a generic social profile as event source', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: 'https://www.instagram.com/bootshaus/',
      organizerName: 'BOOTSHAUS',
      eventTitle: 'Halloween 2026',
    });

    expect(projection.eventSourceUrl).toBeUndefined();
    expect(projection.officialSourceMissingReason).toBe('generic_social_profile');
    expect(projection.visibleLinks).toEqual([]);
    expect(projection.organizerSocialUrl).toBeUndefined();
  });

  it('rejects a social post without a verified account binding', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: permalink,
      organizerName: 'BOOTSHAUS',
      eventTitle: 'Halloween 2026',
      venueName: 'Bootshaus',
      startsAt: '2026-10-31',
    });

    expect(projection.officialSourceMissingReason).toBe('social_post_unverified');
    expect(projection.visibleLinks).toEqual([]);
  });

  it('rejects a similar but unverified account name', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: permalink,
      organizerName: 'BOOTSHAUS',
      eventTitle: 'Halloween 2026',
      venueName: 'Bootshaus',
      startsAt: '2026-10-31T22:00:00+01:00',
      verifiedOfficialAccounts: [{ handle: 'bootshaus', verified: true }],
      verifiedSocialEventSources: [
        {
          url: permalink,
          accountHandle: 'bootshaus.official',
          verifiedAccount: true,
          expectedTitle: 'Halloween 2026',
          expectedVenueName: 'Bootshaus',
          expectedStartDate: '2026-10-31',
        },
      ],
    });

    expect(projection.officialSourceMissingReason).toBe('social_post_unverified');
  });

  it('rejects a verified post assigned to the wrong event identity', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: permalink,
      organizerName: 'BOOTSHAUS',
      eventTitle: 'NYE 2026',
      venueName: 'Bootshaus',
      startsAt: '2026-12-31T22:00:00+01:00',
      verifiedOfficialAccounts: [{ handle: 'bootshaus', verified: true }],
      verifiedSocialEventSources: [
        {
          url: permalink,
          accountHandle: 'bootshaus',
          verifiedAccount: true,
          expectedTitle: 'Halloween 2026',
          expectedVenueName: 'Bootshaus',
          expectedStartDate: '2026-10-31',
        },
      ],
    });

    expect(projection.officialSourceMissingReason).toBe('social_source_wrong_event');
    expect(projection.visibleLinks).toEqual([]);
  });

  it('accepts a verified permalink as event source and keeps profiles in organizer links', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: permalink,
      organizerName: 'BOOTSHAUS',
      eventTitle: 'Halloween 2026',
      venueName: 'Bootshaus',
      startsAt: '2026-10-31T22:00:00+01:00',
      verifiedOfficialAccounts: [{ handle: 'bootshaus', verified: true }],
      verifiedSocialEventSources: [
        {
          url: permalink,
          accountHandle: 'bootshaus',
          verifiedAccount: true,
          expectedTitle: 'Halloween 2026',
          expectedVenueName: 'Bootshaus',
          expectedStartDate: '2026-10-31',
        },
      ],
      verifiedOrganizerSocialUrls: ['https://www.instagram.com/bootshaus/'],
      purchaseTicketUrl: 'https://bootshaus-club.ticket.io/Hv4f09p8/',
    });

    expect(projection.eventSourceUrl).toBe(permalink);
    expect(projection.officialEventUrl).toBeUndefined();
    expect(projection.visibleLinks).toEqual([
      {
        role: 'official_social_post',
        label: 'Offizieller Instagram-Beitrag von Bootshaus',
        url: permalink,
      },
    ]);
    expect(projection.organizerSocialUrl).toBe('https://www.instagram.com/bootshaus/');
    expect(projection.organizerLinks.some((link) => link.url === permalink)).toBe(false);
    expect(projection.visibleLinks.some((link) => link.url === projection.ticketUrl)).toBe(false);
  });

  it('does not render unverified organizer social profiles', () => {
    const projection = resolveConsumerOfficialSource({
      officialUrl: officialPage,
      organizerName: 'BOOTSHAUS',
    });

    expect(projection.organizerLinks.every((link) => link.role !== 'organizer_social')).toBe(true);
    expect(projection.organizerSocialUrl).toBeUndefined();
  });
});
