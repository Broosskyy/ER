import {
  adminOrganizerRepository,
  adminVenueRepository,
  artistRepository,
  eventRepository,
  organizerRepository,
  venueRepository,
} from '@/data/repositories/registry';
import { entityAliasStore } from '@/features/profiles/profile-runtime-wiring';
import type { ArtistRecord, OrganizerRecord, VenueRecord } from '@/data/types/records';
import {
  groupEventsByProfileBucket,
  type EntityProfileEvents,
} from '@/features/events/domain/entity-profile-events-service';
import type { Event } from '@/features/events/types/event';
import type { FollowEntityType } from '@/features/follows/follow-service';

import { filterProfileEvents } from './entity-profile-events-filter';
import { resolveCanonicalEntityId } from './canonical-entity-id-resolver';
import { isInternalEntityId } from '@/features/events/discovery/internal-event-eligibility';

export interface LoadedEntityProfile<TRecord> {
  canonicalId: string;
  record: TRecord;
  events: EntityProfileEvents;
}

function slugifyName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

async function loadEventsForIds(eventIds: string[]): Promise<Event[]> {
  const events = eventIds
    .map((eventId) => eventRepository.getEventById(eventId))
    .filter((event): event is Event => event !== undefined);
  return filterProfileEvents(events);
}

async function resolveOrganizerRecord(
  rawId: string,
): Promise<{ canonicalId: string; record: OrganizerRecord | null }> {
  const canonicalId = await resolveCanonicalEntityId('organizer', rawId, async (id) =>
    Boolean(await organizerRepository.getById(id)),
  );
  const record =
    (await organizerRepository.getById(canonicalId)) ??
    (await organizerRepository.getBySlug(rawId));
  return { canonicalId: record?.id ?? canonicalId, record };
}

async function resolveVenueRecord(
  rawId: string,
): Promise<{ canonicalId: string; record: VenueRecord | null }> {
  const canonicalId = await resolveCanonicalEntityId('venue', rawId, async (id) =>
    Boolean(await venueRepository.getById(id)),
  );
  const record =
    (await venueRepository.getById(canonicalId)) ??
    (await venueRepository.getBySlug(rawId));
  return { canonicalId: record?.id ?? canonicalId, record };
}

async function resolveArtistRecord(
  rawId: string,
): Promise<{ canonicalId: string; record: ArtistRecord | null }> {
  const canonicalId = await resolveCanonicalEntityId('artist', rawId, async (id) =>
    Boolean(await artistRepository.getPublishedById(id)),
  );
  const record =
    (await artistRepository.getPublishedById(canonicalId)) ??
    (await artistRepository.getPublishedBySlug(rawId));
  return { canonicalId: record?.id ?? canonicalId, record };
}

export async function loadOrganizerProfile(
  rawId: string,
): Promise<LoadedEntityProfile<OrganizerRecord> | null> {
  if (isInternalEntityId(rawId)) {
    return null;
  }
  const { canonicalId, record } = await resolveOrganizerRecord(rawId);
  if (!record) {
    return null;
  }

  const eventIds = await adminOrganizerRepository.listEventIdsForOrganizer(record.id);
  const events = groupEventsByProfileBucket(await loadEventsForIds(eventIds));

  return { canonicalId: record.id, record, events };
}

export async function loadVenueProfile(
  rawId: string,
): Promise<LoadedEntityProfile<VenueRecord> | null> {
  if (isInternalEntityId(rawId)) {
    return null;
  }
  const { canonicalId, record } = await resolveVenueRecord(rawId);
  if (record) {
    const eventIds = await adminVenueRepository.listEventIdsForVenue(record.id);
    const events = groupEventsByProfileBucket(await loadEventsForIds(eventIds));
    return { canonicalId: record.id, record, events };
  }

  const legacySlug = slugifyName(rawId);
  const legacyEvents = filterProfileEvents(
    eventRepository.getPublishedEvents().filter(
      (event) =>
        (event.venueId && event.venueId === canonicalId) ||
        slugifyName(event.venue) === legacySlug ||
        event.venue.toLowerCase() === rawId.trim().toLowerCase(),
    ),
  );

  if (legacyEvents.length === 0) {
    return null;
  }

  const fallbackRecord: VenueRecord = {
    id: canonicalId,
    slug: legacySlug,
    name: legacyEvents[0]?.venue ?? rawId,
    city: legacyEvents[0]?.city ?? '',
    country: legacyEvents[0]?.country ?? '',
    street: legacyEvents[0]?.address,
    latitude: legacyEvents[0]?.latitude,
    longitude: legacyEvents[0]?.longitude,
    createdAt: legacyEvents[0]?.createdAt ?? new Date().toISOString(),
    updatedAt: legacyEvents[0]?.updatedAt ?? new Date().toISOString(),
  };

  return {
    canonicalId,
    record: fallbackRecord,
    events: groupEventsByProfileBucket(legacyEvents),
  };
}

export async function loadArtistProfile(
  rawId: string,
): Promise<LoadedEntityProfile<ArtistRecord> | null> {
  if (isInternalEntityId(rawId)) {
    return null;
  }
  const { canonicalId, record } = await resolveArtistRecord(rawId);
  if (!record) {
    return null;
  }

  const eventIds = await artistRepository.listEventIdsForArtist(record.id);
  const events = groupEventsByProfileBucket(await loadEventsForIds(eventIds));

  return { canonicalId: record.id, record, events };
}

export async function loadEntityProfile(
  entityType: FollowEntityType,
  rawId: string,
): Promise<LoadedEntityProfile<OrganizerRecord | VenueRecord | ArtistRecord> | null> {
  if (entityType === 'organizer') {
    return loadOrganizerProfile(rawId);
  }
  if (entityType === 'venue') {
    return loadVenueProfile(rawId);
  }
  return loadArtistProfile(rawId);
}

export function listArtistAliases(artistId: string): string[] {
  return entityAliasStore
    .listAliases('artist', artistId)
    .map((alias) => alias.originalAlias ?? alias.aliasValue)
    .filter((value, index, values) => values.indexOf(value) === index);
}
