import type { GenreConfidenceBand } from '../genre-evidence';
import type { ArtistProfileConfidence } from './types';
import { SEARCHABLE_CONFIDENCE } from './types';

export function artistConfidenceToGenreBand(
  confidence: ArtistProfileConfidence,
): GenreConfidenceBand {
  switch (confidence) {
    case 'EXPLICIT':
      return 'EXPLICIT';
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'MEDIUM';
    case 'LOW':
      return 'LOW';
    case 'CONFLICT':
    case 'UNRESOLVED':
    default:
      return 'UNRESOLVED';
  }
}

export function isSearchableGenreConfidence(confidence: GenreConfidenceBand): boolean {
  return SEARCHABLE_CONFIDENCE.includes(confidence);
}

export function lineupConsensusConfidence(input: {
  classifiedArtists: number;
  totalArtists: number;
  headlinerMatch: boolean;
  maxVotes: number;
  voteThreshold: number;
  unanimousAmongClassified?: boolean;
}): GenreConfidenceBand {
  if (input.totalArtists === 1 && input.headlinerMatch && input.classifiedArtists === 1) {
    return 'HIGH';
  }
  if (input.classifiedArtists === 0) {
    return 'UNRESOLVED';
  }
  if (input.unanimousAmongClassified && input.classifiedArtists >= 2 && input.maxVotes >= input.voteThreshold) {
    return 'HIGH';
  }
  const classifiedCoverage = input.maxVotes / Math.max(1, input.classifiedArtists);
  if (classifiedCoverage >= 0.5 && input.maxVotes >= input.voteThreshold) {
    return 'HIGH';
  }
  const coverage = input.classifiedArtists / Math.max(1, input.totalArtists);
  if (coverage >= 0.5 && input.maxVotes >= input.voteThreshold) {
    return 'HIGH';
  }
  if (input.maxVotes >= input.voteThreshold) {
    return 'MEDIUM';
  }
  return 'UNRESOLVED';
}
