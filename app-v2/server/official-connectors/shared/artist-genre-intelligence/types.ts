import type { GenreConfidenceBand } from '../genre-evidence';

export type ArtistEvidenceSourceType =
  | 'MUSICBRAINZ'
  | 'DISCOGS'
  | 'EVENT_DESCRIPTION'
  | 'HISTORICAL_EVENT'
  | 'EVENT_SERIES'
  | 'STRUCTURED_SOURCE';

export type ArtistEvidenceStrength = 'STRONG' | 'MODERATE' | 'WEAK';

export type ArtistProfileConfidence = 'EXPLICIT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRESOLVED' | 'CONFLICT';

export type ArtistUnresolvedReason =
  | 'ARTIST_METADATA_MISSING'
  | 'LINEUP_INCOMPLETE'
  | 'SOURCE_METADATA_MISSING'
  | 'EVENT_DESCRIPTION_INSUFFICIENT'
  | 'CONFLICTING_GENRES'
  | 'GENUINELY_UNRESOLVED'
  | 'ARTIST_IDENTITY_AMBIGUOUS'
  | 'PROVIDER_UNAVAILABLE';

export interface ArtistGenreEvidence {
  artistIdentity: string;
  normalizedName: string;
  genreKey: string;
  displayName: string;
  sourceType: ArtistEvidenceSourceType;
  sourceReference: string;
  evidenceStrength: ArtistEvidenceStrength;
  confidence: ArtistProfileConfidence;
  observedAt: string;
  rawLabel?: string;
  classificationReason: string;
}

export interface ArtistGenreProfile {
  artistIdentity: string;
  normalizedName: string;
  genreEvidence: ArtistGenreEvidence[];
  canonicalGenres: Array<{
    genreKey: string;
    displayName: string;
    confidence: ArtistProfileConfidence;
    sourceCount: number;
  }>;
  confidence: ArtistProfileConfidence;
  sourceCount: number;
  observedAt: string;
  refreshedAt: string;
  staleAfter?: string;
  classificationReason?: string;
}

export interface ArtistProviderHealth {
  providerId: string;
  requests: number;
  successes: number;
  failures: number;
  timeouts: number;
}

export interface ArtistCacheMetrics {
  artistCacheEntries: number;
  artistEvidenceRecords: number;
  artistCacheHits: number;
  artistCacheMisses: number;
  artistEvidenceProviderRequests: number;
  providerSuccesses: number;
  providerFailures: number;
  providerTimeouts: number;
  staleArtistProfiles: number;
}

export interface LineupConsensusEvidence {
  type: 'LINEUP_CONSENSUS' | 'HEADLINER_PROFILE' | 'EVENT_SERIES';
  artistCount: number;
  classifiedArtists: number;
  genreVotes: Record<string, number>;
  headlinerIdentity?: string;
}

export interface EventGenreExplanation {
  eventId: string;
  title: string;
  genres: Array<{
    genre: string;
    genreKey: string;
    confidence: GenreConfidenceBand;
    evidence: LineupConsensusEvidence[];
    artistProfilesUsed: string[];
    classificationReason: string;
  }>;
}

export interface GenreUnresolvedBaselineEntry {
  canonicalEventId: string;
  title: string;
  date: string | null;
  venue: string | null;
  city: string | null;
  organizer: string | null;
  currentGenres: string[];
  lineup: string[];
  lineupCompleteness: string;
  description: string | null;
  sourceBindings: Array<{ role: string; url: string; connectorId: string | null }>;
  ticketProvider: string | null;
  checkedLayers: string[];
  artistsWithKnownGenreEvidence: string[];
  artistsWithoutKnownGenreEvidence: string[];
  failureReason: ArtistUnresolvedReason;
  failureDetail: string;
}

export const ARTIST_PROFILE_STALE_DAYS = 30;
export const SEARCHABLE_CONFIDENCE: GenreConfidenceBand[] = ['EXPLICIT', 'HIGH', 'MEDIUM'];
