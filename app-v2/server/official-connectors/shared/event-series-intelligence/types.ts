import type { GenreConfidenceBand } from '../genre-evidence';

export interface EventSeriesGenreEvidence {
  genreKey: string;
  displayName: string;
  sourceReference: string;
  classificationReason: string;
  confidence: GenreConfidenceBand;
}

export interface EventSeriesGenreProfile {
  seriesId: string;
  canonicalName: string;
  aliases: string[];
  genres: string[];
  evidence: EventSeriesGenreEvidence[];
  confidence: GenreConfidenceBand;
  sourceUrls: string[];
  observedAt: string;
  lastVerifiedAt: string;
}

export interface EventSeriesIdentityMatch {
  seriesId: string;
  canonicalName: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
}
