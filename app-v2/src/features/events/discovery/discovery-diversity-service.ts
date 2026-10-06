import type { RankedEvent } from '@/features/events/discovery/discovery-ranking-service';

export interface DiverseRankedEvent extends RankedEvent {
  organizer?: string;
  organizerId?: string;
  venue?: string;
  venueId?: string;
  duplicateGroupId?: string;
  seriesId?: string;
  cancelled?: boolean;
  postponed?: boolean;
}

export const DISCOVERY_DIVERSITY_POLICY = {
  maxConsecutiveOrganizerEvents: 2,
  maxSeriesEvents: 2,
} as const;

export class DiscoveryDiversityService {
  diversify(events: DiverseRankedEvent[]): DiverseRankedEvent[] {
    const seenCanonicalIds = new Set<string>();
    const seenDuplicateGroups = new Set<string>();
    const seriesCounts = new Map<string, number>();
    const result: DiverseRankedEvent[] = [];
    let consecutiveOrganizer: string | undefined;
    let consecutiveOrganizerCount = 0;

    for (const event of events) {
      if (seenCanonicalIds.has(event.canonicalEventId)) continue;
      if (event.duplicateGroupId && seenDuplicateGroups.has(event.duplicateGroupId)) continue;
      if (event.seriesId && (seriesCounts.get(event.seriesId) ?? 0) >= DISCOVERY_DIVERSITY_POLICY.maxSeriesEvents) continue;

      const organizerKey = event.organizerId ?? event.organizer;
      if (organizerKey === consecutiveOrganizer) {
        if (consecutiveOrganizerCount >= DISCOVERY_DIVERSITY_POLICY.maxConsecutiveOrganizerEvents) continue;
        consecutiveOrganizerCount += 1;
      } else {
        consecutiveOrganizer = organizerKey;
        consecutiveOrganizerCount = 1;
      }

      seenCanonicalIds.add(event.canonicalEventId);
      if (event.duplicateGroupId) seenDuplicateGroups.add(event.duplicateGroupId);
      if (event.seriesId) seriesCounts.set(event.seriesId, (seriesCounts.get(event.seriesId) ?? 0) + 1);
      result.push(event);
    }
    return result;
  }
}

export const discoveryDiversityService = new DiscoveryDiversityService();
