import { ArtistProfileStore } from '../shared/artist-genre-intelligence/artist-profile-store';
import { expandLineupActsForProfileLookup } from '../shared/artist-genre-intelligence/artist-identity';
import { getAncestorGenreKeys } from '../shared/genre-taxonomy';

export type LineupDomainBoost = 'HIGH' | 'LIKELY' | 'NONE';

export interface LineupDomainEvidence {
  lineupArtistCount: number;
  classifiedElectronicArtists: number;
  unclassifiedArtists: number;
  domainBoost: LineupDomainBoost;
  reasons: string[];
  artistProfilesUsed: string[];
}

function isElectronicProfileGenre(genreKey: string): boolean {
  const ancestors = getAncestorGenreKeys(genreKey);
  return ancestors.includes('electronic') || genreKey === 'electronic';
}

export function deriveLineupDomainEvidence(input: {
  title: string;
  lineup: string[];
  store?: ArtistProfileStore;
}): LineupDomainEvidence {
  const store = input.store ?? new ArtistProfileStore();
  if (!input.store) {
    store.load();
  }

  const lineup = expandLineupActsForProfileLookup(input.lineup);
  const reasons: string[] = [];
  const artistProfilesUsed: string[] = [];
  let classifiedElectronicArtists = 0;
  let classifiedAny = 0;

  for (const act of lineup) {
    const profile = store.getProfile(act);
    if (!profile || profile.canonicalGenres.length === 0 || profile.confidence === 'CONFLICT') {
      continue;
    }
    classifiedAny += 1;
    artistProfilesUsed.push(act);
    const hasElectronic = profile.canonicalGenres.some((genre) => isElectronicProfileGenre(genre.genreKey));
    if (hasElectronic) {
      classifiedElectronicArtists += 1;
      reasons.push(`artist_electronic:${act}`);
    }
  }

  const b2bCount = lineup.filter((act) => /\bb2b\b/i.test(act)).length;
  const multiArtistClubLineup =
    lineup.length >= 4 &&
    (/(?:klub|club|floor|rave|night)/i.test(input.title) || b2bCount >= 1);

  let domainBoost: LineupDomainBoost = 'NONE';
  if (classifiedElectronicArtists >= 2) {
    domainBoost = 'HIGH';
    reasons.push('multi_artist_electronic_consensus');
  } else if (classifiedElectronicArtists === 1 && lineup.length >= 3) {
    domainBoost = 'LIKELY';
    reasons.push('single_electronic_artist_with_multi_act_lineup');
  } else if (multiArtistClubLineup && classifiedAny === 0 && lineup.length >= 5) {
    domainBoost = 'LIKELY';
    reasons.push('multi_artist_club_lineup_without_genre_label');
  }

  return {
    lineupArtistCount: lineup.length,
    classifiedElectronicArtists,
    unclassifiedArtists: Math.max(0, lineup.length - classifiedAny),
    domainBoost,
    reasons,
    artistProfilesUsed,
  };
}
