import { hasIncompatibleGenreFamilies } from '../genre-taxonomy';
import { canonicalGenreKey } from '../normalize-genre';
import type { ArtistGenreEvidence, ArtistGenreProfile, ArtistProfileConfidence } from './types';

const STRENGTH_WEIGHT: Record<ArtistGenreEvidence['evidenceStrength'], number> = {
  STRONG: 3,
  MODERATE: 2,
  WEAK: 1,
};

const CONFIDENCE_RANK: Record<ArtistProfileConfidence, number> = {
  EXPLICIT: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  UNRESOLVED: 1,
  CONFLICT: 0,
};

function maxConfidence(
  left: ArtistProfileConfidence,
  right: ArtistProfileConfidence,
): ArtistProfileConfidence {
  return CONFIDENCE_RANK[left] >= CONFIDENCE_RANK[right] ? left : right;
}

export function buildArtistGenreProfile(input: {
  normalizedName: string;
  artistIdentity: string;
  evidence: ArtistGenreEvidence[];
  observedAt: string;
}): ArtistGenreProfile {
  const genreVotes = new Map<
    string,
    {
      genreKey: string;
      displayName: string;
      weight: number;
      sourceTypes: Set<string>;
      maxConfidence: ArtistProfileConfidence;
    }
  >();

  for (const record of input.evidence) {
    const key = canonicalGenreKey(record.genreKey);
    const current = genreVotes.get(key) ?? {
      genreKey: key,
      displayName: record.displayName,
      weight: 0,
      sourceTypes: new Set<string>(),
      maxConfidence: 'UNRESOLVED' as ArtistProfileConfidence,
    };
    current.weight += STRENGTH_WEIGHT[record.evidenceStrength];
    current.sourceTypes.add(record.sourceType);
    current.maxConfidence = maxConfidence(current.maxConfidence, record.confidence);
    genreVotes.set(key, current);
  }

  const canonicalGenres = [...genreVotes.values()]
    .map((entry) => {
      let confidence: ArtistProfileConfidence = 'UNRESOLVED';
      if (entry.sourceTypes.size >= 2 && entry.weight >= 4) {
        confidence = 'HIGH';
      } else if (entry.sourceTypes.size >= 2) {
        confidence = 'MEDIUM';
      } else if (entry.weight >= 3) {
        confidence = 'HIGH';
      } else if (entry.weight >= 2) {
        confidence = 'MEDIUM';
      } else if (entry.weight >= 1) {
        confidence = 'LOW';
      }
      confidence = maxConfidence(confidence, entry.maxConfidence);
      return {
        genreKey: entry.genreKey,
        displayName: entry.displayName,
        confidence,
        sourceCount: entry.sourceTypes.size,
      };
    })
    .filter((entry) => entry.confidence !== 'UNRESOLVED' && entry.confidence !== 'LOW')
    .sort((left, right) => CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence]);

  const hasNarrowConflict =
    canonicalGenres.length >= 2 &&
    hasIncompatibleGenreFamilies(canonicalGenres.map((genre) => genre.genreKey));

  let profileConfidence: ArtistProfileConfidence = 'UNRESOLVED';
  if (canonicalGenres.length > 0) {
    profileConfidence = hasNarrowConflict
      ? 'CONFLICT'
      : canonicalGenres.reduce(
          (best, genre) => maxConfidence(best, genre.confidence),
          'UNRESOLVED' as ArtistProfileConfidence,
        );
  }

  const sourceCount = new Set(input.evidence.map((entry) => entry.sourceType)).size;

  return {
    artistIdentity: input.artistIdentity,
    normalizedName: input.normalizedName,
    genreEvidence: input.evidence,
    canonicalGenres: hasNarrowConflict ? [] : canonicalGenres.slice(0, 4),
    confidence: profileConfidence,
    sourceCount,
    observedAt: input.observedAt,
    refreshedAt: input.observedAt,
    classificationReason:
      canonicalGenres.length === 0
        ? 'no_publishable_artist_genre_evidence'
        : hasNarrowConflict
          ? 'artist_genre_conflict_review'
          : 'artist_evidence_consensus',
  };
}

export function mergeArtistEvidence(
  existing: ArtistGenreEvidence[],
  incoming: ArtistGenreEvidence[],
): ArtistGenreEvidence[] {
  const merged = new Map<string, ArtistGenreEvidence>();
  for (const record of [...existing, ...incoming]) {
    const key = `${record.sourceType}:${record.genreKey}:${record.sourceReference}`;
    const prior = merged.get(key);
    if (!prior || CONFIDENCE_RANK[record.confidence] > CONFIDENCE_RANK[prior.confidence]) {
      merged.set(key, record);
    }
  }
  return [...merged.values()];
}
