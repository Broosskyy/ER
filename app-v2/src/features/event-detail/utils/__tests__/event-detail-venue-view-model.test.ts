import { describe, expect, it } from 'vitest';

import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { VenueRecord } from '@/data/types/records';
import {
  resolveEventDetailAddressValidity,
  toOrganizerDetailViewModel,
  toVenueDetailViewModel,
} from '@/features/event-detail/utils/event-detail-view-model';

function baseEvent(overrides: Partial<EventDisplayModel> = {}): EventDisplayModel {
  return {
    id: 'evt-bc173',
    slug: 'evt-bc173',
    title: 'BC173',
    description: '',
    image: { uri: '' },
    date: '15.08.',
    startTime: '16:00',
    venue: 'Moxy Köln/Bonn Flughafen',
    city: 'Köln',
    country: 'DE',
    address: 'Auenweg 173, 51063 Köln',
    genres: ['Techno'],
    artists: [],
    source: 'supabase',
    sourceLabel: 'Bootshaus',
    startsAt: '2026-08-15T14:00:00.000Z',
    startDateTime: '2026-08-15T14:00:00.000Z',
    timezone: 'Europe/Berlin',
    status: 'published',
    venueLabel: 'Moxy Köln/Bonn Flughafen',
    cityLabel: 'Köln',
    locationLabelComma: 'Moxy Köln/Bonn Flughafen, Köln',
    locationLabelDot: 'Moxy Köln/Bonn Flughafen · Köln',
    knownArtistNames: [],
    lineupCompleteness: 'full',
    ticketProviderLabel: 'Ticket.io',
    organizer: 'Bootshaus',
    organizerId: 'organizer-bootshaus',
    venueId: 'venue-bootshaus-koeln',
    ...overrides,
  } as EventDisplayModel;
}

const bootshausVenue: VenueRecord = {
  id: 'venue-bootshaus-koeln',
  slug: 'bootshaus',
  name: 'Bootshaus',
  city: 'Köln',
  address: 'Auenweg 173, 51063 Köln',
  street: 'Auenweg 173',
  latitude: 50.9234,
  longitude: 6.9672,
  country: 'DE',
  venueType: 'club',
  createdAt: '',
  updatedAt: '',
};

const bootshausOrganizer = {
  id: 'organizer-bootshaus',
  slug: 'bootshaus',
  name: 'Bootshaus',
  city: 'Köln',
  country: 'DE',
  createdAt: '',
  updatedAt: '',
};

describe('event detail venue view model', () => {
  it('shows Moxy in venue card when stale Bootshaus relation is linked', () => {
    const event = baseEvent();
    const venue = toVenueDetailViewModel(event, {
      venue: bootshausVenue,
      organizer: bootshausOrganizer,
    });

    expect(venue.name).toBe('Moxy Köln/Bonn Flughafen');
    expect(venue.verified).toBe(false);
    expect(venue.profileNavigable).toBe(false);
    expect(venue.addressLabel).toBeUndefined();
  });

  it('does not route to Bootshaus coordinates when venue relation is stale', () => {
    const event = baseEvent();
    const validity = resolveEventDetailAddressValidity(event, {
      venue: bootshausVenue,
      organizer: bootshausOrganizer,
    });

    expect(validity.canOpenDirections).toBe(false);
    expect(validity.streetAddress).toBeUndefined();
  });

  it('keeps organizer Bootshaus on organizer card', () => {
    const event = baseEvent();
    const organizer = toOrganizerDetailViewModel(event, {
      venue: bootshausVenue,
      organizer: bootshausOrganizer,
    });

    expect(organizer?.organizer.name).toBe('Bootshaus');
    expect(organizer?.profileNavigable).toBe(true);
  });
});
