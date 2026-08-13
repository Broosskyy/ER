import { mapEventRowToDomain, type EventRow } from '@/data/mappers/event-mapper';
import type {
  CanonicalLineupEntry,
  ResolvedCanonicalLineupEntry,
} from '@/features/aggregation/domain/canonical-lineup-entry';
import { mapResolvedEntriesToProjections } from '@/features/events/domain/event-lineup-entry-projection';
import { readCanonicalLineup } from '@/features/events/domain/canonical-lineup-read';
import type { Event } from '@/features/events/types/event';
import { compactLineupArtistIdentityKey } from '@/features/import/domain/golden-content-quality-gate';
import type { CanonicalEventPersistencePayload } from '@/features/import/services/canonical-event-persistence-payload';

export function resolveStructuredLineupForReadback(
  entries: CanonicalLineupEntry[],
): ResolvedCanonicalLineupEntry[] {
  return [...entries]
    .sort((left, right) => left.order - right.order)
    .map((entry, index) => ({
      order: entry.order ?? index,
      artists: entry.artists.map((name) => name.trim()).filter(Boolean),
      artistIds: entry.artists.map(
        (name, artistIndex) =>
          `readback-${compactLineupArtistIdentityKey(name) || `${index}-${artistIndex}`}`,
      ),
      billingRelation: entry.billingRelation,
      confidence: entry.confidence ?? 0.86,
      stage: entry.stage,
      startTime: entry.startTime,
      endTime: entry.endTime,
      runningOrder: entry.runningOrder,
      provenance: entry.provenance ?? { source: 'structured' },
    }));
}

/** Productive consumer read path after DB persistence (no parallel preview shapes). */
export function mapPersistenceReadbackToDomainEvent(input: {
  id: string;
  title: string;
  startDate: string;
  payload: CanonicalEventPersistencePayload;
  ticketUrl?: string;
  priceText?: string;
  venueName?: string;
  venueCity?: string;
  websiteUrl?: string;
  status?: EventRow['status'];
}): Event {
  const structuredEntries = resolveStructuredLineupForReadback(input.payload.structuredLineupEntries);
  const canonicalLineup = readCanonicalLineup({
    structuredEntries,
    compatibilityLineup: [],
    eventTitle: input.title,
  });

  const row: Partial<EventRow> = {
    id: input.id,
    title: input.title,
    description: input.payload.eventPatch.description ?? '',
    genre_labels: input.payload.eventPatch.genreLabels,
    start_date: input.startDate,
    status: input.status ?? 'published',
    ticket_url: input.ticketUrl ?? null,
    price_text: input.priceText ?? null,
    venue_name: input.venueName ?? null,
    venue_city: input.venueCity ?? null,
    website_url: input.websiteUrl ?? null,
    timezone: 'Europe/Berlin',
  };

  return mapEventRowToDomain(row as EventRow, {
    artists: canonicalLineup.artistNames,
    lineup: canonicalLineup.artistNames,
    lineupEntries: canonicalLineup.lineupEntries,
    artistIds: canonicalLineup.artistIds,
    venueName: input.venueName,
    cityName: input.venueCity,
  });
}

export function lineupBillingLabelsFromDomainEvent(event: Event): string[] {
  if (event.lineupEntries?.length) {
    return [...event.lineupEntries]
      .sort((left, right) => left.order - right.order)
      .map((entry) => entry.artists.join(' & '));
  }
  return event.artists ?? [];
}

export function structuredLineupProjectionsFromReadback(
  entries: CanonicalLineupEntry[],
): ReturnType<typeof mapResolvedEntriesToProjections> {
  return mapResolvedEntriesToProjections(resolveStructuredLineupForReadback(entries));
}
