import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  artistRepository,
  eventRepository,
  importEventPublishService,
  organizerRepository,
  venueRepository,
} from '@/data/repositories/registry';
import { resolveEntityProfileRoute } from '@/features/profiles/routes/entity-profile-routes';

type Classification =
  | 'canonical_profile_ready'
  | 'canonical_entity_missing_profile'
  | 'text_only_relationship'
  | 'duplicate_entity_candidate'
  | 'invalid_entity_type'
  | 'missing_slug'
  | 'route_missing'
  | 'follow_target_missing'
  | 'not_publicly_eligible';

interface EntityAuditRow {
  entityType: 'artist' | 'venue' | 'organizer';
  entityId?: string;
  label: string;
  eventId: string;
  eventTitle: string;
  classification: Classification;
  route?: string;
}

async function main(): Promise<void> {
  await importEventPublishService.refreshConsumerFeed();

  const events = eventRepository.getPublishedEvents();
  const [artists, venues, organizers] = await Promise.all([
    artistRepository.getPublished(),
    venueRepository.getAll(),
    organizerRepository.getAll(),
  ]);

  const artistById = new Map(artists.map((artist) => [artist.id, artist]));
  const venueById = new Map(venues.map((venue) => [venue.id, venue]));
  const organizerById = new Map(organizers.map((organizer) => [organizer.id, organizer]));
  const rows: EntityAuditRow[] = [];

  for (const event of events) {
    if (event.venueId) {
      const venue = venueById.get(event.venueId);
      const route = venue ? resolveEntityProfileRoute('venue', venue.slug || venue.id) : undefined;
      rows.push({
        entityType: 'venue',
        entityId: event.venueId,
        label: venue?.name ?? event.venue,
        eventId: event.id,
        eventTitle: event.title,
        classification: !venue
          ? 'canonical_entity_missing_profile'
          : !venue.slug
            ? 'missing_slug'
            : !route
              ? 'route_missing'
              : 'canonical_profile_ready',
        route,
      });
    } else if (event.venue?.trim()) {
      rows.push({
        entityType: 'venue',
        label: event.venue,
        eventId: event.id,
        eventTitle: event.title,
        classification: 'text_only_relationship',
      });
    }

    if (event.organizerId) {
      const organizer = organizerById.get(event.organizerId);
      const route = organizer
        ? resolveEntityProfileRoute('organizer', organizer.slug || organizer.id)
        : undefined;
      rows.push({
        entityType: 'organizer',
        entityId: event.organizerId,
        label: organizer?.name ?? event.organizer ?? event.organizerId,
        eventId: event.id,
        eventTitle: event.title,
        classification: !organizer
          ? 'canonical_entity_missing_profile'
          : !organizer.slug
            ? 'missing_slug'
            : !route
              ? 'route_missing'
              : 'canonical_profile_ready',
        route,
      });
    } else if (event.organizer?.trim()) {
      rows.push({
        entityType: 'organizer',
        label: event.organizer,
        eventId: event.id,
        eventTitle: event.title,
        classification: 'text_only_relationship',
      });
    }

    const artistIds = event.artistIds ?? [];
    if (artistIds.length > 0) {
      for (const artistId of artistIds) {
        const artist = artistById.get(artistId);
        const route = artist
          ? resolveEntityProfileRoute('artist', artist.slug || artist.id)
          : undefined;
        rows.push({
          entityType: 'artist',
          entityId: artistId,
          label: artist?.name ?? artistId,
          eventId: event.id,
          eventTitle: event.title,
          classification: !artist
            ? 'canonical_entity_missing_profile'
            : !artist.slug
              ? 'missing_slug'
              : !route
                ? 'route_missing'
                : 'canonical_profile_ready',
          route,
        });
      }
    } else {
      for (const name of event.artists ?? []) {
        if (!name.trim()) continue;
        rows.push({
          entityType: 'artist',
          label: name,
          eventId: event.id,
          eventTitle: event.title,
          classification: 'text_only_relationship',
        });
      }
    }
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.classification] = (acc[row.classification] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'select_only',
    publishedEventCount: events.length,
    relationshipCount: rows.length,
    classificationCounts: counts,
    sample: rows.slice(0, 50),
    dryRunRepairProposals: rows
      .filter((row) =>
        ['canonical_entity_missing_profile', 'missing_slug', 'text_only_relationship'].includes(
          row.classification,
        ),
      )
      .slice(0, 100)
      .map((row) => ({
        action: 'review_only',
        ...row,
      })),
  };

  const outputPath = resolve(
    process.cwd(),
    'docs/real-data/_phase46_entity_profile_audit.json',
  );
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, ...report.classificationCounts, relationshipCount: rows.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
