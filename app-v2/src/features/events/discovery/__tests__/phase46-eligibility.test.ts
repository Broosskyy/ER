import { describe, expect, it } from 'vitest';

import { discoveryEligibilityResolver } from '@/features/events/discovery/discovery-eligibility-resolver';
import type { Event } from '@/features/events/types/event';

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    slug: 'event-1',
    title: 'Night Shift',
    description: 'Description',
    startDateTime: '2027-08-01T20:00:00.000Z',
    timezone: 'Europe/Berlin',
    venue: 'Bootshaus',
    city: 'Köln',
    country: 'Germany',
    genres: ['Techno'],
    artists: ['WESTBAM'],
    organizer: 'Boiler Room',
    source: 'ticket.io',
    sourceEventId: 'tio-1',
    status: 'published',
    imageUrl: 'https://example.com/flyer.jpg',
    latitude: 50.9,
    longitude: 6.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Phase 4.6 discovery eligibility', () => {
  it('excludes internal staging/demo records from public surfaces', () => {
    const internal = event({ id: 'staging-seed-1', source: 'staging-seed' });
    const eligibility = discoveryEligibilityResolver.resolve(internal);

    expect(eligibility.homeEligible).toBe(false);
    expect(eligibility.searchEligible).toBe(false);
    expect(eligibility.mapEligible).toBe(false);
    expect(eligibility.similarEventsEligible).toBe(false);
    expect(eligibility.reasonCodes).toContain('internal_test_data');
    expect(eligibility.savedEligible).toBe(true);
  });

  it('enforces surface-specific flags', () => {
    const withoutImage = event({ imageUrl: undefined });
    expect(discoveryEligibilityResolver.isEligibleForSurface(withoutImage, 'home_featured')).toBe(
      false,
    );
    expect(discoveryEligibilityResolver.isEligibleForSurface(withoutImage, 'search_events')).toBe(
      true,
    );

    const withoutCoords = event({ latitude: undefined, longitude: undefined });
    expect(discoveryEligibilityResolver.isEligibleForSurface(withoutCoords, 'map')).toBe(false);
    expect(discoveryEligibilityResolver.isEligibleForSurface(withoutCoords, 'events_list')).toBe(
      true,
    );
  });
});
