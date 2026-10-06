import { describe, expect, it, vi } from 'vitest';

import { fetchPublishedEventDetails } from '@/data/repositories/event-core-read';
import { EventRepository } from '@/data/repositories/repositories';

describe('EventRepository', () => {
  it('loads published details into summaries and detail cache', () => {
    const repository = new EventRepository();
    const detail = {
      id: 'event-1',
      title: 'Eternal Rave Core Test',
      startsAt: '2026-09-05T18:00:00Z',
      endsAt: '2026-09-06T04:00:00Z',
      timezone: 'Europe/Berlin',
      imageUrl: null,
      organizerName: 'Eternal Rave Test',
      venue: {
        id: 'venue-1',
        name: 'Eternal Rave Test Venue',
        addressLine: null,
        postalCode: null,
        city: 'Köln',
        countryCode: 'DE',
        latitude: null,
        longitude: null,
        officialUrl: null,
      },
      genres: [],
      primaryTicket: null,
      description: 'Roundtrip description',
      officialUrl: null,
      publishedAt: '2026-08-14T08:00:00Z',
      lineup: [],
      tickets: [],
    };

    repository.initializeSync([detail]);

    expect(repository.getPublishedSummaries()).toHaveLength(1);
    expect(repository.getPublishedDetail('event-1')?.title).toBe('Eternal Rave Core Test');
    expect(repository.hasPublishedEvent('missing')).toBe(false);
  });

  it('does not query event_sources when loading published events', async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    id: 'event-1',
                    status: 'published',
                    title: 'Eternal Rave Core Test',
                    description: 'Roundtrip description',
                    starts_at: '2026-09-05T18:00:00Z',
                    ends_at: '2026-09-06T04:00:00Z',
                    timezone: 'Europe/Berlin',
                    image_url: null,
                    official_url: null,
                    venue_id: 'venue-1',
                    organizer_name: 'Eternal Rave Test',
                    created_by: null,
                    published_at: '2026-08-14T08:00:00Z',
                    created_at: '2026-08-14T08:00:00Z',
                    updated_at: '2026-08-14T08:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'venues') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  id: 'venue-1',
                  name: 'Eternal Rave Test Venue',
                  address_line: null,
                  postal_code: null,
                  city: 'Köln',
                  country_code: 'DE',
                  latitude: null,
                  longitude: null,
                  official_url: null,
                  created_at: '2026-08-14T08:00:00Z',
                  updated_at: '2026-08-14T08:00:00Z',
                },
              ],
              error: null,
            }),
          }),
        };
      }

      return {
        select: () => ({
          in: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      };
    });

    const details = await fetchPublishedEventDetails({ from: fromSpy } as never);

    expect(fromSpy).not.toHaveBeenCalledWith('event_sources');
    expect(details).toHaveLength(1);
    expect(details[0]?.venue?.city).toBe('Köln');
  });
});
