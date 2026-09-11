import { describe, expect, it } from 'vitest';

import { simulateGenreSearchRecall } from '../network-discovery/genre-search-recall';
import type { GenreCoverageEntry } from '../network-discovery/genre-coverage-audit';

describe('genre search recall simulation', () => {
  it('flags recoverable false negatives when canonical genres are missing', () => {
    const entries: GenreCoverageEntry[] = [
      {
        eventId: 'a',
        title: 'Hard Techno Night',
        sources: [],
        currentGenres: [],
        availableGenreEvidence: ['Hard Techno'],
        evidenceStrength: 'strong',
        recommendedGenres: ['Hard Techno'],
        classification: 'GENRE_RECOVERABLE',
        checkedLayers: ['description'],
        explicitGenreCount: 0,
        lineupDerivedGenres: [],
        confidenceBand: 'HIGH',
      },
    ];
    const report = simulateGenreSearchRecall(entries);
    expect(report.recoverableFalseNegatives).toBeGreaterThan(0);
  });
});
