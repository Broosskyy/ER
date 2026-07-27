export type DiscoverySurface =
  | 'home_featured'
  | 'home_today'
  | 'home_nearby'
  | 'events_explore'
  | 'events_list'
  | 'search_events'
  | 'similar_events'
  | 'map'
  | 'organizer_events';

export interface RankingContext {
  surface: DiscoverySurface;
  timestamp: string;
  city?: string;
  selectedGenres?: string[];
}

export interface RankableEvent {
  canonicalEventId: string;
  startDateTime: string;
  publishedAt?: string;
  city?: string;
  genres?: string[];
  eventQuality: number;
  sourceTrust: number;
  freshness: number;
  hasImage: boolean;
  hasTickets: boolean;
  featured?: boolean;
  cancelled?: boolean;
  conflictCount?: number;
  duplicateConfidence?: number;
}

export interface RankedEvent extends RankableEvent {
  score: number;
}

export class DiscoveryRankingService {
  rank(events: RankableEvent[], context: RankingContext): RankedEvent[] {
    const now = new Date(context.timestamp).getTime();
    return events.map((event) => {
      const hoursUntilStart = (new Date(event.startDateTime).getTime() - now) / 3_600_000;
      const timeRelevance = hoursUntilStart >= 0 ? Math.max(0, 25 - Math.min(25, hoursUntilStart / 24)) : -30;
      const cityMatch = context.city && context.city === event.city ? 8 : 0;
      const genreMatch = context.selectedGenres?.some((genre) => event.genres?.includes(genre)) ? 6 : 0;
      const score = event.eventQuality * 0.35 + event.sourceTrust * 0.18 + event.freshness * 0.12 +
        timeRelevance + cityMatch + genreMatch + (event.hasImage ? 4 : 0) + (event.hasTickets ? 3 : 0) +
        (event.featured ? 5 : 0) - (event.conflictCount ?? 0) * 12 -
        (event.cancelled ? 40 : 0) - (event.duplicateConfidence ?? 0) * 10;
      return { ...event, score };
    }).sort((left, right) =>
      right.score - left.score ||
      new Date(left.startDateTime).getTime() - new Date(right.startDateTime).getTime() ||
      new Date(left.publishedAt ?? 0).getTime() - new Date(right.publishedAt ?? 0).getTime() ||
      left.canonicalEventId.localeCompare(right.canonicalEventId),
    );
  }
}

export const discoveryRankingService = new DiscoveryRankingService();
