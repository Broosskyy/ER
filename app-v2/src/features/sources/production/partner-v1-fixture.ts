/**
 * Contract fixture for Eternal Rave Partner Feed V1 (Rheinland Nights API).
 * Used for reproducible tests — live URL requires ER_PARTNER_V1_API_URL + contractual approval.
 */
export const PARTNER_V1_API_FIXTURE = {
  meta: {
    partner: 'Rheinland Nights Collective',
    version: '1.0',
    generated_at: '2026-07-01T12:00:00.000Z',
  },
  data: {
    events: [
      {
        id: 'rn-warehouse-2026',
        name: 'Warehouse Sessions Köln',
        subtitle: 'All night techno',
        description: 'Curated warehouse night with international headliners.',
        starts_at: '2026-09-20T22:00:00+02:00',
        ends_at: '2026-09-21T04:00:00+02:00',
        timezone: 'Europe/Berlin',
        url: 'https://partner.rheinland-nights.example/events/warehouse-sessions',
        venue: {
          name: 'Bootshaus',
          address: 'Auenweg 173, 51063 Köln',
          city: 'Köln',
        },
        organizer: {
          name: 'Rheinland Nights',
        },
        artists: [{ name: 'Ben Klock' }, { name: 'DVS1' }],
        genres: ['Techno', 'Industrial'],
        tickets: {
          url: 'https://tickets.rheinland-nights.example/warehouse-sessions',
        },
        images: {
          primary: 'https://cdn.rheinland-nights.example/warehouse-sessions.jpg',
        },
      },
      {
        id: 'rn-open-air-2026',
        name: 'Rheinland Open Air',
        description: 'Open air showcase on the Rhine.',
        starts_at: '2026-10-12T14:00:00+02:00',
        ends_at: '2026-10-12T23:00:00+02:00',
        timezone: 'Europe/Berlin',
        url: 'https://partner.rheinland-nights.example/events/open-air',
        venue: {
          name: 'Rheinpark',
          address: 'Rheinpark, Köln',
          city: 'Köln',
        },
        organizer: {
          name: 'Rheinland Nights',
        },
        artists: [{ name: 'Kobosil' }],
        genres: ['Techno'],
        tickets: {
          url: 'https://tickets.rheinland-nights.example/open-air',
        },
        images: {
          primary: 'https://cdn.rheinland-nights.example/open-air.jpg',
        },
      },
      {
        id: 'rn-minimal-2026',
        name: 'Minimal Listing',
        starts_at: '2026-11-01T20:00:00+01:00',
        venue: {
          city: 'Düsseldorf',
        },
      },
    ],
  },
} as const;
