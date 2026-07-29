import type { ArtistIdentityResolver } from '@/features/entity-resolution/artist-identity-resolver';
import type { OrganizerIdentityResolver } from '@/features/entity-resolution/organizer-identity-resolver';
import type { VenueIdentityResolver } from '@/features/entity-resolution/venue-identity-resolver';
import { artistMatchingService } from '@/features/import/matching/artist-matching-service';
import { cityMatchingService } from '@/features/import/matching/city-matching-service';
import { duplicateDetectionService } from '@/features/import/matching/duplicate-detection-service';
import { genreMatchingService } from '@/features/import/matching/genre-matching-service';
import type { MatchResult, MatchingCatalog } from '@/features/import/matching/match-result';
import { createEmptyMatchResult } from '@/features/import/matching/match-result';
import { venueMatchingService } from '@/features/import/matching/venue-matching-service';
import { organizerMatchingService } from '@/features/import/matching/organizer-matching-service';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

import {
  buildEntityMatchLogs,
  buildEntityMatchWarning,
  readCandidateMetadataString,
  resolveImportSourceId,
  resolveLinkedEntityId,
} from './entity-resolution-match-bridge';

export interface MatchLogEntry {
  level: 'info' | 'warning';
  code: string;
  message: string;
}

export interface ImportMatchingIdentityResolvers {
  venueResolver: VenueIdentityResolver;
  organizerResolver: OrganizerIdentityResolver;
  artistResolver: ArtistIdentityResolver;
}

export class ImportMatchingService {
  constructor(private readonly identityResolvers?: ImportMatchingIdentityResolvers) {}

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

    if (this.identityResolvers) {
      this.matchEntitiesWithResolvers(candidate, catalog, result, logs, result.matchedCityId);
    } else {
      this.matchEntitiesLegacy(candidate, catalog, result, logs, result.matchedCityId);
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

  private matchEntitiesLegacy(
    candidate: NormalizedEventCandidate,
    catalog: MatchingCatalog,
    result: MatchResult,
    logs: MatchLogEntry[],
    matchedCityId?: string,
  ): void {
    const venue = venueMatchingService.match(candidate, catalog, matchedCityId);
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
  }

  private matchEntitiesWithResolvers(
    candidate: NormalizedEventCandidate,
    catalog: MatchingCatalog,
    result: MatchResult,
    logs: MatchLogEntry[],
    matchedCityId?: string,
  ): void {
    const resolvers = this.identityResolvers;
    if (!resolvers) {
      return;
    }

    const sourceId = resolveImportSourceId(candidate);

    const venueOutcome = resolvers.venueResolver.resolve({
      candidate,
      catalog,
      sourceId,
      matchedCityId,
      externalVenueId: readCandidateMetadataString(
        candidate,
        'externalVenueId',
        'venueExternalId',
      ),
      websiteUrl: readCandidateMetadataString(candidate, 'venueWebsite', 'venueUrl'),
    });
    const venueId = resolveLinkedEntityId(venueOutcome);
    if (venueId) {
      result.matchedVenueId = venueId;
      result.details.venueConfidence = venueOutcome.confidenceScore;
    }
    logs.push(...buildEntityMatchLogs('venue', venueOutcome, candidate.venueName));
    const venueWarning = buildEntityMatchWarning(venueOutcome, 'Venue');
    if (venueWarning) {
      result.warnings.push(venueWarning);
    }

    const organizerOutcome = resolvers.organizerResolver.resolve({
      candidate,
      catalog,
      sourceId,
      externalOrganizerId: readCandidateMetadataString(
        candidate,
        'externalOrganizerId',
        'organizerExternalId',
      ),
      officialUrl: readCandidateMetadataString(
        candidate,
        'organizerUrl',
        'organizerWebsite',
      ),
      socialHandle: readCandidateMetadataString(candidate, 'organizerSocialHandle'),
    });
    const organizerId = resolveLinkedEntityId(organizerOutcome);
    if (organizerId) {
      result.matchedOrganizerId = organizerId;
      result.details.organizerConfidence = organizerOutcome.confidenceScore;
    }
    logs.push(...buildEntityMatchLogs('organizer', organizerOutcome, candidate.organizerName));
    const organizerWarning = buildEntityMatchWarning(organizerOutcome, 'Organizer');
    if (organizerWarning) {
      result.warnings.push(organizerWarning);
    }

    const artistOutcomes = resolvers.artistResolver.resolveAll({
      candidate,
      catalog,
      sourceId,
      externalArtistId: readCandidateMetadataString(candidate, 'externalArtistId', 'artistExternalId'),
      profileUrl: readCandidateMetadataString(candidate, 'artistProfileUrl', 'artistUrl'),
      socialHandle: readCandidateMetadataString(candidate, 'artistSocialHandle'),
    });

    for (const [index, artistOutcome] of artistOutcomes.entries()) {
      const artistName = candidate.artistNames?.[index] ?? `artist-${index + 1}`;
      const artistId = resolveLinkedEntityId(artistOutcome);
      result.details.artistConfidences.push(artistOutcome.confidenceScore);
      if (artistId) {
        result.matchedArtistIds.push(artistId);
      }
      logs.push(...buildEntityMatchLogs('artist', artistOutcome, artistName));
      const artistWarning = buildEntityMatchWarning(artistOutcome, `Artist "${artistName}"`);
      if (artistWarning) {
        result.warnings.push(artistWarning);
      }
    }
  }
}

export const importMatchingService = new ImportMatchingService();
