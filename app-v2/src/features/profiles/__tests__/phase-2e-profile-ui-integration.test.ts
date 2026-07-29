import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@/features/events/data/demo-images', () => ({
  getSourceDisplayLabel: (source: string) => source,
  getEventImageAsset: () => 0,
  EVENT_IMAGE_ASSETS: {},
}));

import { FixedClock } from '@/core/clock/fixed-clock';
import { EventRepository } from '@/data/repositories/repositories';
import type { OrganizerRecord, VenueRecord, ArtistRecord } from '@/data/types/records';
import {
  toLineupSectionViewModel,
  toOrganizerDetailViewModel,
  toVenueDetailViewModel,
} from '@/features/event-detail/utils/event-detail-view-model';
import { groupEventsByProfileBucket } from '@/features/events/domain/entity-profile-events-service';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { Event } from '@/features/events/types/event';
import { InMemoryEntityAliasStore } from '@/features/entity-resolution/entity-alias-store';
import { InMemoryRealDataDomainEventBus } from '@/features/events/domain/real-data-domain-events';
import {
  AsyncStorageFollowStorage,
  FollowService,
  InMemoryFollowStorage,
} from '@/features/follows/follow-service';
import { filterProfileEvents } from '@/features/profiles/services/entity-profile-events-filter';
const baseEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'evt-1',
  slug: 'evt-1',
  title: 'Techno Night',
  description: 'Desc',
  startDateTime: '2026-08-01T20:00:00.000Z',
  endDateTime: '2026-08-02T04:00:00.000Z',
  timezone: 'Europe/Berlin',
  venue: 'Bootshaus',
  city: 'Köln',
  country: 'Germany',
  genres: ['Techno'],
  artists: ['Ben Klock'],
  organizer: 'Boiler Room',
  venueId: 'venue-1',
  organizerId: 'org-1',
  artistIds: ['artist-1'],
  source: 'source-a',
  sourceEventId: 'evt-1',
  status: 'published',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

const organizerRecord: OrganizerRecord = {
  id: 'org-1',
  slug: 'boiler-room',
  name: 'Boiler Room',
  description: 'Global music broadcaster',
  website: 'boilerroom.tv',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const venueRecord: VenueRecord = {
  id: 'venue-1',
  slug: 'bootshaus',
  name: 'Bootshaus',
  city: 'Köln',
  country: 'Germany',
  street: 'Auenweg',
  houseNumber: '173',
  postalCode: '51063',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const displayEvent = (overrides: Partial<EventDisplayModel> = {}): EventDisplayModel => ({
  id: 'evt-1',
  slug: 'evt-1',
  title: 'Techno Night',
  description: 'Desc',
  image: 0,
  date: '01.08.',
  startTime: '22:00',
  venue: 'Bootshaus',
  city: 'Köln',
  genres: ['Techno'],
  artists: ['Ben Klock'],
  organizer: 'Boiler Room',
  source: 'source-a',
  sourceLabel: 'Source',
  startsAt: '2026-08-01T20:00:00.000Z',
  startDateTime: '2026-08-01T20:00:00.000Z',
  timezone: 'Europe/Berlin',
  status: 'published',
  venueId: 'venue-1',
  organizerId: 'org-1',
  artistIds: ['artist-1'],
  ...overrides,
});

const artistRecord: ArtistRecord = {
  id: 'artist-1',
  slug: 'ben-klock',
  name: 'Ben Klock',
  genreIds: [],
  status: 'published',
  verificationStatus: 'verified',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Phase 2E profile UI integration', () => {
  beforeEach(() => {
    const repository = new EventRepository();
    repository.initializeSync([baseEvent()]);
  });

  it('builds organizer and venue profile links when FK entities are loaded', () => {
    const display = displayEvent();
    const organizer = toOrganizerDetailViewModel(display, { organizer: organizerRecord });
    const venue = toVenueDetailViewModel(display, { venue: venueRecord });

    expect(organizer?.profileNavigable).toBe(true);
    expect(organizer?.organizer.id).toBe('org-1');
    expect(venue.profileNavigable).toBe(true);
    expect(venue.id).toBe('venue-1');
  });

  it('does not create profile links without canonical IDs', () => {
    const display = displayEvent({
      organizerId: undefined,
      venueId: undefined,
      artistIds: undefined,
    });
    const organizer = toOrganizerDetailViewModel(display, { organizer: null });
    const venue = toVenueDetailViewModel(display, { venue: null });
    const lineup = toLineupSectionViewModel(display, { artistsById: new Map() });

    expect(organizer?.profileNavigable).toBe(false);
    expect(venue.profileNavigable).toBe(false);
    expect(lineup?.artists[0]?.profileNavigable).toBe(false);
    expect(lineup?.artists[0]?.id).toBeUndefined();
  });

  it('links lineup artists by artistId without duplicates', () => {
    const display = displayEvent({
      artists: ['Ben Klock', 'Ben Klock'],
      artistIds: ['artist-1', 'artist-1'],
    });
    const lineup = toLineupSectionViewModel(display, {
      artistsById: new Map([['artist-1', artistRecord]]),
    });

    expect(lineup?.artists).toHaveLength(1);
    expect(lineup?.artists[0]?.id).toBe('artist-1');
    expect(lineup?.artists[0]?.profileNavigable).toBe(true);
  });

  it('groups profile events into upcoming, live and past buckets', () => {
    const clock = new FixedClock(new Date('2026-07-15T12:00:00.000Z'));
    const events = filterProfileEvents([
      baseEvent({ id: 'upcoming', startDateTime: '2026-08-01T20:00:00.000Z' }),
      baseEvent({
        id: 'live',
        startDateTime: '2026-07-15T10:00:00.000Z',
        endDateTime: '2026-07-15T14:00:00.000Z',
      }),
      baseEvent({
        id: 'past',
        startDateTime: '2026-07-10T20:00:00.000Z',
        endDateTime: '2026-07-11T00:00:00.000Z',
      }),
      baseEvent({ id: 'archived', status: 'archived', startDateTime: '2026-09-01T20:00:00.000Z' }),
    ]);
    const grouped = groupEventsByProfileBucket(events, clock);

    expect(grouped.upcoming.map((event) => event.id)).toEqual(['upcoming']);
    expect(grouped.happeningNow.map((event) => event.id)).toEqual(['live']);
    expect(grouped.past.map((event) => event.id)).toEqual(['past']);
    expect(filterProfileEvents([baseEvent({ id: 'archived', status: 'archived' })])).toEqual([]);
  });

  it('deduplicates profile events by canonical event id after merge', () => {
    const repository = new EventRepository();
    repository.applyCanonicalAliases(new Map([['legacy-evt', 'evt-1']]));
    repository.initializeSync([
      baseEvent({ id: 'evt-1' }),
      baseEvent({ id: 'legacy-evt', canonicalEventId: 'evt-1' }),
    ]);

    const filtered = filterProfileEvents(repository.getPublishedEvents());
    expect(filtered.map((event) => event.id)).toEqual(['evt-1']);
  });

  it('follows canonical organizer id and persists across service re-instantiation', async () => {
    const storage = new InMemoryFollowStorage();
    const bus = new InMemoryRealDataDomainEventBus();
    const serviceA = new FollowService({
      storage,
      domainEventBus: bus,
      resolveCanonicalId: async (_type, id) => (id === 'legacy-org' ? 'org-1' : id),
    });

    await serviceA.follow('organizer', 'legacy-org');

    const serviceB = new FollowService({
      storage,
      resolveCanonicalId: async (_type, id) => (id === 'legacy-org' ? 'org-1' : id),
    });
    expect(await serviceB.isFollowing('organizer', 'org-1')).toBe(true);
    expect(await serviceB.isFollowing('organizer', 'legacy-org')).toBe(true);
    expect(bus.listByType('entity_followed')).toHaveLength(1);
  });

  it('prevents duplicate follows on double follow calls', async () => {
    const storage = new InMemoryFollowStorage();
    const service = new FollowService({ storage });
    await service.follow('venue', 'venue-1');
    await service.follow('venue', 'venue-1');
    expect((await service.list('venue')).map((entry) => entry.canonicalEntityId)).toEqual(['venue-1']);
  });

  it('keeps organizer, venue and artist follows separated', async () => {
    const storage = new InMemoryFollowStorage();
    const service = new FollowService({ storage });
    await service.follow('organizer', 'org-1');
    await service.follow('venue', 'venue-1');
    await service.follow('artist', 'artist-1');
    expect(await service.isFollowing('organizer', 'org-1')).toBe(true);
    expect(await service.isFollowing('venue', 'org-1')).toBe(false);
    expect(await service.isFollowing('artist', 'org-1')).toBe(false);
  });

  it('resolves entity alias for profile routing', () => {
    const aliasStore = new InMemoryEntityAliasStore();
    aliasStore.saveAlias({
      entityType: 'organizer',
      canonicalId: 'org-1',
      aliasType: 'external_id',
      aliasValue: 'legacy-org',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(aliasStore.findCanonicalId('organizer', 'external_id', 'legacy-org')).toBe('org-1');
  });

  it('persists follows via async storage adapter', async () => {
    const memory = new Map<string, string>();
    const storage = new AsyncStorageFollowStorage({
      getItem: async (key) => memory.get(key) ?? null,
      setItem: async (key, value) => {
        memory.set(key, value);
      },
    });
    const serviceA = new FollowService({ storage });
    await serviceA.follow('artist', 'artist-1');

    const serviceB = new FollowService({ storage });
    expect(await serviceB.isFollowing('artist', 'artist-1')).toBe(true);
  });
});
