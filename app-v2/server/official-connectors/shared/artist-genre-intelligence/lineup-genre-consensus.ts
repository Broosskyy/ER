import { getAncestorGenreKeys } from '../genre-taxonomy';
import { canonicalGenreKey } from '../normalize-genre';
import type { GenreConfidenceBand } from '../genre-evidence';
import { artistConfidenceToGenreBand, lineupConsensusConfidence } from './discovery-confidence-policy';
import { extractHeadlinerFromTitle, getArtistIdentityKey } from './artist-identity';
import type { ArtistGenreProfile, EventGenreExplanation, LineupConsensusEvidence } from './types';
import type { ArtistProfileStore } from './artist-profile-store';

export interface LineupGenreConsensusResult {
  genres: Array<{ genreKey: string; displayName: string; confidence: GenreConfidenceBand }>;
  classifiedArtists: number;
  unclassifiedArtists: number;
  genreDistribution: Record<string, number>;
  artistProfilesUsed: string[];
  explanation: LineupConsensusEvidence;
}

const HEADLINER_WEIGHT = 2;
const MIN_VOTES_MULTI_ACT = 2;

export function deriveEventGenresFromLineupConsensus(input: {
  eventId: string;
  title: string;
  lineup: string[];
  store: ArtistProfileStore;
}): LineupGenreConsensusResult {
  const headliner = extractHeadlinerFromTitle(input.title);
  const headlinerKey = headliner ? getArtistIdentityKey(headliner) : undefined;
  const genreVotes = new Map<string, { genreKey: string; displayName: string; votes: number }>();
  let classifiedArtists = 0;
  const artistProfilesUsed: string[] = [];

  for (const act of input.lineup) {
    const profile = input.store.getProfile(act);
    const actKey = getArtistIdentityKey(act);
    const weight =
      headlinerKey && actKey === headlinerKey ? HEADLINER_WEIGHT : 1;
    if (!profile || profile.canonicalGenres.length === 0 || profile.confidence === 'CONFLICT') {
      continue;
    }
    classifiedArtists += 1;
    artistProfilesUsed.push(actKey);
    for (const genre of profile.canonicalGenres) {
      const current = genreVotes.get(genre.genreKey) ?? {
        genreKey: genre.genreKey,
        displayName: genre.displayName,
        votes: 0,
      };
      current.votes += weight;
      genreVotes.set(genre.genreKey, current);
    }
  }

  const totalArtists = input.lineup.length;
  const unclassifiedArtists = Math.max(0, totalArtists - classifiedArtists);
  const genreDistribution: Record<string, number> = {};
  for (const [key, value] of genreVotes.entries()) {
    genreDistribution[key] = value.votes;
  }

  if (totalArtists === 0) {
    return {
      genres: [],
      classifiedArtists: 0,
      unclassifiedArtists: 0,
      genreDistribution: {},
      artistProfilesUsed: [],
      explanation: {
        type: 'LINEUP_CONSENSUS',
        artistCount: 0,
        classifiedArtists: 0,
        genreVotes: {},
      },
    };
  }

  if (totalArtists === 1) {
    const profile = input.store.getProfile(input.lineup[0]!);
    if (profile && profile.canonicalGenres.length > 0 && profile.confidence !== 'CONFLICT') {
      const genres = profile.canonicalGenres.slice(0, 3).map((genre) => ({
        genreKey: genre.genreKey,
        displayName: genre.displayName,
        confidence: artistConfidenceToGenreBand(genre.confidence),
      }));
      return {
        genres,
        classifiedArtists: 1,
        unclassifiedArtists: 0,
        genreDistribution,
        artistProfilesUsed: [getArtistIdentityKey(input.lineup[0]!)],
        explanation: {
          type: 'HEADLINER_PROFILE',
          artistCount: 1,
          classifiedArtists: 1,
          genreVotes: genreDistribution,
          headlinerIdentity: getArtistIdentityKey(input.lineup[0]!),
        },
      };
    }
  }

  const weightedClassified = classifiedArtists + (headlinerKey ? 1 : 0);
  const threshold = Math.max(
    MIN_VOTES_MULTI_ACT,
    Math.ceil(Math.max(1, weightedClassified) * 0.4),
  );
  const maxVotes = [...genreVotes.values()].reduce((max, entry) => Math.max(max, entry.votes), 0);
  const confidence = lineupConsensusConfidence({
    classifiedArtists,
    totalArtists,
    headlinerMatch: Boolean(headlinerKey && artistProfilesUsed.includes(headlinerKey)),
    maxVotes,
    voteThreshold: threshold,
    unanimousAmongClassified: classifiedArtists > 0 && maxVotes >= classifiedArtists,
  });

  const selected = [...genreVotes.values()]
    .filter((entry) => entry.votes >= threshold)
    .sort((left, right) => right.votes - left.votes)
    .slice(0, 3)
    .map((entry) => ({
      genreKey: entry.genreKey,
      displayName: entry.displayName,
      confidence,
    }));

  if (selected.length === 0 && headlinerKey) {
    const headlinerProfile = input.store.getProfile(headliner ?? '');
    if (headlinerProfile && headlinerProfile.canonicalGenres.length > 0) {
      const genres = headlinerProfile.canonicalGenres.slice(0, 3).map((genre) => ({
        genreKey: genre.genreKey,
        displayName: genre.displayName,
        confidence: artistConfidenceToGenreBand(genre.confidence),
      }));
      return {
        genres,
        classifiedArtists,
        unclassifiedArtists,
        genreDistribution,
        artistProfilesUsed: [...new Set([...artistProfilesUsed, headlinerKey])],
        explanation: {
          type: 'HEADLINER_PROFILE',
          artistCount: totalArtists,
          classifiedArtists,
          genreVotes: genreDistribution,
          headlinerIdentity: headlinerKey,
        },
      };
    }
  }

  return {
    genres: selected,
    classifiedArtists,
    unclassifiedArtists,
    genreDistribution,
    artistProfilesUsed,
    explanation: {
      type: 'LINEUP_CONSENSUS',
      artistCount: totalArtists,
      classifiedArtists,
      genreVotes: genreDistribution,
      headlinerIdentity: headlinerKey,
    },
  };
}

export function buildEventGenreExplanation(input: {
  eventId: string;
  title: string;
  consensus: LineupGenreConsensusResult;
}): EventGenreExplanation {
  return {
    eventId: input.eventId,
    title: input.title,
    genres: input.consensus.genres.map((genre) => ({
      genre: genre.displayName,
      genreKey: genre.genreKey,
      confidence: genre.confidence,
      evidence: [input.consensus.explanation],
      artistProfilesUsed: input.consensus.artistProfilesUsed,
      classificationReason:
        input.consensus.explanation.type === 'HEADLINER_PROFILE'
          ? 'headliner_artist_profile'
          : 'lineup_artist_consensus',
    })),
  };
}

export function expandConsensusGenresForSearch(genreKeys: string[]): string[] {
  const expanded = new Set<string>();
  for (const key of genreKeys) {
    expanded.add(canonicalGenreKey(key));
    for (const ancestor of getAncestorGenreKeys(key)) {
      expanded.add(ancestor);
    }
  }
  return [...expanded];
}
