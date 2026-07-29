import {
  artistRepository,
  organizerRepository,
  venueRepository,
} from '@/data/repositories/registry';
import type { ArtistRecord, OrganizerRecord, VenueRecord } from '@/data/types/records';
import type { Event } from '@/features/events/types/event';
import { resolveCanonicalEntityId } from '@/features/profiles/services/canonical-entity-id-resolver';

export interface EventDetailEntities {
  organizer: OrganizerRecord | null;
  venue: VenueRecord | null;
  artistsById: Map<string, ArtistRecord>;
}

export async function loadEventDetailEntities(event: Event): Promise<EventDetailEntities> {
  const organizerId = event.organizerId
    ? await resolveCanonicalEntityId('organizer', event.organizerId, async (id) =>
        Boolean(await organizerRepository.getById(id)),
      )
    : undefined;
  const venueId = event.venueId
    ? await resolveCanonicalEntityId('venue', event.venueId, async (id) =>
        Boolean(await venueRepository.getById(id)),
      )
    : undefined;

  const [organizer, venue] = await Promise.all([
    organizerId ? organizerRepository.getById(organizerId) : Promise.resolve(null),
    venueId ? venueRepository.getById(venueId) : Promise.resolve(null),
  ]);

  const artistIds = [...new Set(event.artistIds ?? [])];
  const artistRecords = await Promise.all(
    artistIds.map(async (artistId) => {
      const canonicalId = await resolveCanonicalEntityId('artist', artistId, async (id) =>
        Boolean(await artistRepository.getPublishedById(id)),
      );
      const record = await artistRepository.getPublishedById(canonicalId);
      return record ? ([canonicalId, record] as const) : null;
    }),
  );

  const artistsById = new Map<string, ArtistRecord>();
  for (const entry of artistRecords) {
    if (entry) {
      artistsById.set(entry[0], entry[1]);
    }
  }

  return { organizer, venue, artistsById };
}
