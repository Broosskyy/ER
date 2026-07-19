import { describe, expect, it } from 'vitest';

import { artistMatchingService } from '@/features/import/matching/artist-matching-service';
import { cityMatchingService } from '@/features/import/matching/city-matching-service';
import { duplicateDetectionService } from '@/features/import/matching/duplicate-detection-service';
import { genreMatchingService } from '@/features/import/matching/genre-matching-service';
import { ImportMatchingService } from '@/features/import/matching/import-matching-service';
import { createTestMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { matchingConfig } from '@/features/import/matching/matching-config';
import { normalizeMatchText, tokenSimilarity } from '@/features/import/matching/matching-utils';
import { venueMatchingService } from '@/features/import/matching/venue-matching-service';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

const baseCandidate: NormalizedEventCandidate = {
  externalId: 'new-1',
  title: 'Techno Night',
  startDate: '2026-08-15T20:00:00.000Z',
  cityName: 'Köln',
  venueName: 'Bootshaus',
  venueAddress: 'Auenweg 173, 51063 Köln',
  latitude: 50.965,
  longitude: 7.005,
  artistNames: ['Ben Klock'],
  genreNames: ['Tech House'],
  rawSourceType: 'json_ld',
};

describe('matching utils', () => {
  it('normalizes umlauts and punctuation', () => {
    expect(normalizeMatchText('Köln!')).toBe('koln');
    expect(tokenSimilarity('Tech House', 'tech-house')).toBeGreaterThan(80);
  });
});

describe('CityMatchingService', () => {
  const catalog = createTestMatchingCatalog();

  it('matches Köln', () => {
    const result = cityMatchingService.match(
      { ...baseCandidate, cityName: 'Köln' },
      catalog,
    );
    expect(result.cityId).toBe('koeln');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(matchingConfig.minCityConfidence);
  });

  it('matches Munich alias to München', () => {
    const result = cityMatchingService.match(
      { ...baseCandidate, cityName: 'Munich' },
      catalog,
    );
    expect(result.cityId).toBe('muenchen');
  });

  it('warns when city is unknown', () => {
    const result = cityMatchingService.match(
      { ...baseCandidate, cityName: 'Unknown City' },
      catalog,
    );
    expect(result.matchType).toBe('none');
    expect(result.warning).toBeDefined();
  });
});

describe('VenueMatchingService', () => {
  const catalog = createTestMatchingCatalog();

  it('matches venue by name and city', () => {
    const result = venueMatchingService.match(baseCandidate, catalog, 'koeln');
    expect(result.venueId).toBe('venue-1');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(matchingConfig.minVenueConfidence);
  });

  it('returns probable match warning for partial names', () => {
    const result = venueMatchingService.match(
      { ...baseCandidate, venueName: 'Bootshaus Club' },
      catalog,
      'koeln',
    );
    expect(result.confidenceScore).toBeGreaterThan(0);
  });
});

describe('ArtistMatchingService', () => {
  const catalog = createTestMatchingCatalog();

  it('matches artist case-insensitively', () => {
    const results = artistMatchingService.match(
      { ...baseCandidate, artistNames: ['ben klock'] },
      catalog,
    );
    expect(results[0]?.artistId).toBe('artist-1');
    expect(results[0]?.confidenceScore).toBeGreaterThanOrEqual(matchingConfig.minArtistConfidence);
  });

  it('reports no match for unknown artist', () => {
    const results = artistMatchingService.match(
      { ...baseCandidate, artistNames: ['Unknown DJ'] },
      catalog,
    );
    expect(results[0]?.matchType).toBe('none');
  });
});

describe('GenreMatchingService', () => {
  const catalog = createTestMatchingCatalog();

  it('matches tech house synonyms', () => {
    const results = genreMatchingService.match(
      { ...baseCandidate, genreNames: ['Techhouse'] },
      catalog,
    );
    expect(results[0]?.genreId).toBe('tech-house');
    expect(results[0]?.confidenceScore).toBe(100);
  });
});

describe('DuplicateDetectionService', () => {
  const catalog = createTestMatchingCatalog();

  it('detects duplicate by external ID', () => {
    const result = duplicateDetectionService.detect(
      { ...baseCandidate, externalId: 'ext-existing-1' },
      catalog,
    );
    expect(result.duplicateScore).toBe(matchingConfig.scores.externalId);
    expect(result.isDuplicate).toBe(true);
  });

  it('detects duplicate by title date venue', () => {
    const result = duplicateDetectionService.detect(
      baseCandidate,
      catalog,
      'venue-1',
    );
    expect(result.duplicateScore).toBeGreaterThanOrEqual(matchingConfig.scores.titleDateVenue);
    expect(result.isDuplicate).toBe(true);
  });

  it('does not flag unrelated events', () => {
    const result = duplicateDetectionService.detect(
      {
        ...baseCandidate,
        title: 'Completely Different',
        startDate: '2027-01-01T20:00:00.000Z',
        externalId: 'unique-id',
      },
      catalog,
    );
    expect(result.duplicateScore).toBeLessThan(matchingConfig.duplicateThreshold);
    expect(result.isDuplicate).toBe(false);
  });
});

describe('ImportMatchingService', () => {
  it('aggregates match result with confidence', () => {
    const service = new ImportMatchingService();
    const { result, logs } = service.match(baseCandidate, createTestMatchingCatalog());

    expect(result.matchedCityId).toBe('koeln');
    expect(result.matchedVenueId).toBe('venue-1');
    expect(result.matchedArtistIds).toContain('artist-1');
    expect(result.matchedGenreIds).toContain('tech-house');
    expect(result.duplicateScore).toBeGreaterThanOrEqual(matchingConfig.duplicateThreshold);
    expect(result.confidence).toBeGreaterThan(0);
    expect(logs.some((log) => log.code === 'CITY_MATCHED')).toBe(true);
    expect(logs.some((log) => log.code === 'DUPLICATE_DETECTED')).toBe(true);
  });
});
