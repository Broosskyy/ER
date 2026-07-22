import { artistMatchingService } from '@/features/import/matching/artist-matching-service';
import { cityMatchingService } from '@/features/import/matching/city-matching-service';
import { duplicateDetectionService } from '@/features/import/matching/duplicate-detection-service';
import { genreMatchingService } from '@/features/import/matching/genre-matching-service';
import type { MatchResult, MatchingCatalog } from '@/features/import/matching/match-result';
import { createEmptyMatchResult } from '@/features/import/matching/match-result';
import { venueMatchingService } from '@/features/import/matching/venue-matching-service';
import { organizerMatchingService } from '@/features/import/matching/organizer-matching-service';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

export interface MatchLogEntry {
  level: 'info' | 'warning';
  code: string;
  message: string;
}

export class ImportMatchingService {
  match(candidate: NormalizedEventCandidate, catalog: MatchingCatalog): {
    result: MatchResult;
    logs: MatchLogEntry[];
  } {
    const logs: MatchLogEntry[] = [];
    const result = createEmptyMatchResult();

    const city = cityMatchingService.match(candidate, catalog);
    if (city.cityId && city.matchType !== 'none') {
      result.matchedCityId = city.cityId;
      result.details.cityConfidence = city.confidenceScore;
      logs.push({
        level: 'info',
        code: 'CITY_MATCHED',
        message: `City matched with confidence ${city.confidenceScore}.`,
      });
    } else if (city.warning) {
      result.warnings.push(city.warning);
      logs.push({ level: 'warning', code: 'CITY_MATCH_FAILED', message: city.warning });
    }

    const venue = venueMatchingService.match(candidate, catalog, result.matchedCityId);
    if (venue.venueId && venue.matchType !== 'none') {
      result.matchedVenueId = venue.venueId;
      result.details.venueConfidence = venue.confidenceScore;
      logs.push({
        level: 'info',
        code: 'VENUE_MATCHED',
        message: `Venue matched with confidence ${venue.confidenceScore}.`,
      });
    } else if (venue.warning) {
      result.warnings.push(venue.warning);
      logs.push({ level: 'warning', code: 'VENUE_MATCH_FAILED', message: venue.warning });
    }

    const organizer = organizerMatchingService.match(candidate, catalog);
    if (organizer.organizerId && organizer.matchType === 'matched') {
      result.matchedOrganizerId = organizer.organizerId;
      result.details.organizerConfidence = organizer.confidenceScore;
      logs.push({
        level: 'info',
        code: 'ORGANIZER_MATCHED',
        message: `Organizer matched with confidence ${organizer.confidenceScore}.`,
      });
    } else if (organizer.warning) {
      result.warnings.push(organizer.warning);
      logs.push({ level: 'warning', code: 'ORGANIZER_MATCH_FAILED', message: organizer.warning });
    }

    const artists = artistMatchingService.match(candidate, catalog);
    for (const artist of artists) {
      result.details.artistConfidences.push(artist.confidenceScore);
      if (artist.artistId) {
        result.matchedArtistIds.push(artist.artistId);
        logs.push({
          level: 'info',
          code: 'ARTIST_MATCHED',
          message: `Artist "${artist.artistName}" matched with confidence ${artist.confidenceScore}.`,
        });
      } else if (artist.matchType === 'none') {
        const warning = `No artist match for "${artist.artistName}".`;
        result.warnings.push(warning);
        logs.push({ level: 'warning', code: 'ARTIST_MATCH_FAILED', message: warning });
      }
    }

    const genres = genreMatchingService.match(candidate, catalog);
    for (const genre of genres) {
      result.details.genreConfidences.push(genre.confidenceScore);
      if (genre.genreId) {
        result.matchedGenreIds.push(genre.genreId);
        logs.push({
          level: 'info',
          code: 'GENRE_MATCHED',
          message: `Genre "${genre.genreName}" matched with confidence ${genre.confidenceScore}.`,
        });
      } else if (genre.matchType === 'none') {
        const warning = `No genre match for "${genre.genreName}".`;
        result.warnings.push(warning);
        logs.push({ level: 'warning', code: 'GENRE_MATCH_FAILED', message: warning });
      }
    }

    const duplicate = duplicateDetectionService.detect(
      candidate,
      catalog,
      result.matchedVenueId,
      result.matchedArtistIds,
    );
    result.duplicateScore = duplicate.duplicateScore;
    result.duplicateEventId = duplicate.duplicateEventId;
    if (duplicate.isDuplicate) {
      result.warnings.push(duplicate.warning ?? 'Duplicate detected.');
      logs.push({
        level: 'warning',
        code: 'DUPLICATE_DETECTED',
        message: `Duplicate score ${duplicate.duplicateScore}.`,
      });
    }

    const confidenceParts = [
      result.details.cityConfidence,
      result.details.venueConfidence,
      result.details.organizerConfidence,
      ...result.details.artistConfidences,
      ...result.details.genreConfidences,
    ].filter((value): value is number => value !== undefined && value > 0);

    result.confidence =
      confidenceParts.length > 0
        ? Math.round(confidenceParts.reduce((sum, value) => sum + value, 0) / confidenceParts.length)
        : 0;

    logs.push({
      level: 'info',
      code: 'MATCH_CONFIDENCE',
      message: `Overall match confidence ${result.confidence}.`,
    });

    return { result, logs };
  }
}

export const importMatchingService = new ImportMatchingService();
