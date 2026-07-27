import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { MatchingCatalog } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import {
  DuplicateDetectionService,
  type DuplicateDetectionOutcome,
} from '@/features/import/matching/duplicate-detection-service';

export const DUPLICATE_SIGNAL_FIELDS = [
  'title',
  'date',
  'venue',
  'organizer',
  'images',
] as const;

export type DuplicateSignalField = (typeof DUPLICATE_SIGNAL_FIELDS)[number];

export interface DuplicateStrategyResult extends DuplicateDetectionOutcome {
  comparedFields: DuplicateSignalField[];
}

export interface DuplicateStrategy {
  compare(
    candidate: CanonicalImportEvent,
    catalog: MatchingCatalog,
    context?: {
      matchedVenueId?: string;
      matchedArtistIds?: string[];
    },
  ): DuplicateStrategyResult;
}

function toNormalizedCandidate(event: CanonicalImportEvent): NormalizedEventCandidate {
  return {
    externalId: event.externalId,
    sourceUrl: event.sourceUrl,
    title: event.title,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    isAllDay: event.isAllDay,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    cityName: event.cityName,
    countryCode: event.countryCode,
    latitude: event.latitude,
    longitude: event.longitude,
    artistNames: event.artistNames,
    genreNames: event.genreNames,
    ticketUrl: event.ticketUrl,
    eventUrl: event.eventUrl,
    imageUrl: event.imageUrl,
    imageUrls: event.imageUrls,
    organizerName: event.organizerName,
    sourceId: event.sourceId,
    sourceName: event.sourceName,
    rawSourceType: event.rawSourceType,
    sourceMetadata: event.sourceMetadata,
  };
}

export class ScoreBasedDuplicateStrategy implements DuplicateStrategy {
  constructor(private readonly detector = new DuplicateDetectionService()) {}

  compare(
    candidate: CanonicalImportEvent,
    catalog: MatchingCatalog,
    context: {
      matchedVenueId?: string;
      matchedArtistIds?: string[];
    } = {},
  ): DuplicateStrategyResult {
    const outcome = this.detector.detect(
      toNormalizedCandidate(candidate),
      catalog,
      context.matchedVenueId,
      context.matchedArtistIds,
    );

    return {
      ...outcome,
      comparedFields: [...DUPLICATE_SIGNAL_FIELDS],
    };
  }
}

export const scoreBasedDuplicateStrategy = new ScoreBasedDuplicateStrategy();
