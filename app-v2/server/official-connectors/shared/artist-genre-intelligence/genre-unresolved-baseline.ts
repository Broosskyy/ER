import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import type { GenreCoverageEntry } from '../../ticket-evidence/network-discovery/genre-coverage-audit';
import type { LineupCoverageEntry } from '../../ticket-evidence/network-discovery/lineup-coverage-audit';
import type { GenreEvidenceExhaustionResult } from '../genre-evidence';
import { getArtistIdentityKey } from './artist-identity';
import type { ArtistProfileStore } from './artist-profile-store';
import type { ArtistUnresolvedReason, GenreUnresolvedBaselineEntry } from './types';

function classifyFailureReason(input: {
  genre: GenreCoverageEntry;
  lineup: LineupCoverageEntry | undefined;
  evidence: GenreEvidenceExhaustionResult | undefined;
  artistsWithEvidence: string[];
  artistsWithoutEvidence: string[];
}): { reason: ArtistUnresolvedReason; detail: string } {
  if ((input.lineup?.currentLineup.length ?? 0) === 0) {
    return {
      reason: 'LINEUP_INCOMPLETE',
      detail: 'no_verified_lineup_available_for_artist_consensus',
    };
  }
  if (input.artistsWithoutEvidence.length === input.artistsWithoutEvidence.length + input.artistsWithEvidence.length) {
    return {
      reason: 'ARTIST_METADATA_MISSING',
      detail: 'no_lineup_artist_has_publishable_genre_profile',
    };
  }
  if (input.artistsWithEvidence.length > 0 && input.artistsWithoutEvidence.length > 0) {
    const coverage =
      input.artistsWithEvidence.length /
      (input.artistsWithEvidence.length + input.artistsWithoutEvidence.length);
    if (coverage < 0.35) {
      return {
        reason: 'ARTIST_METADATA_MISSING',
        detail: `only_${input.artistsWithEvidence.length}_of_${input.artistsWithEvidence.length + input.artistsWithoutEvidence.length}_lineup_artists_classified`,
      };
    }
  }
  if (input.genre.classification === 'GENRE_CONFLICT_REVIEW') {
    return {
      reason: 'CONFLICTING_GENRES',
      detail: input.genre.reason ?? 'genre_conflict_review',
    };
  }
  if (!input.evidence?.checkedLayers.includes('description') && !input.evidence?.checkedLayers.some((layer) => layer.startsWith('structured_source'))) {
    return {
      reason: 'SOURCE_METADATA_MISSING',
      detail: 'no_structured_or_description_genre_metadata',
    };
  }
  return {
    reason: 'GENUINELY_UNRESOLVED',
    detail: input.genre.reason ?? 'evidence_layers_exhausted_without_genre',
  };
}

export function buildGenreUnresolvedBaseline(input: {
  events: StagingEventSnapshot[];
  genreCoverage: GenreCoverageEntry[];
  lineupCoverage: LineupCoverageEntry[];
  genreEvidence: GenreEvidenceExhaustionResult[];
  store?: ArtistProfileStore;
}): GenreUnresolvedBaselineEntry[] {
  const unresolved = input.genreCoverage.filter(
    (entry) => entry.classification === 'GENRE_UNRESOLVED_NO_EVIDENCE',
  );
  return unresolved.map((genreEntry) => {
    const event = input.events.find((item) => item.eventId === genreEntry.eventId);
    const lineup = input.lineupCoverage.find((item) => item.eventId === genreEntry.eventId);
    const evidence = input.genreEvidence.find((item) => item.eventId === genreEntry.eventId);
    const lineupActs = lineup?.currentLineup ?? event?.lineup ?? [];
    const artistsWithKnownGenreEvidence: string[] = [];
    const artistsWithoutKnownGenreEvidence: string[] = [];
    for (const act of lineupActs) {
      const profile = input.store?.getProfile(act);
      if (profile && profile.canonicalGenres.length > 0 && profile.confidence !== 'CONFLICT') {
        artistsWithKnownGenreEvidence.push(act);
      } else {
        artistsWithoutKnownGenreEvidence.push(act);
      }
    }
    const failure = classifyFailureReason({
      genre: genreEntry,
      lineup,
      evidence,
      artistsWithEvidence: artistsWithKnownGenreEvidence,
      artistsWithoutEvidence: artistsWithoutKnownGenreEvidence,
    });
    const ticketBinding = event?.sources.find((source) => source.sourceRole === 'ticket');
    return {
      canonicalEventId: genreEntry.eventId,
      title: genreEntry.title,
      date: event?.startsAt ?? null,
      venue: event?.venueName ?? null,
      city: event?.venueCity ?? null,
      organizer: event?.organizerName ?? null,
      currentGenres: genreEntry.currentGenres,
      lineup: lineupActs,
      lineupCompleteness: lineup?.classification ?? 'UNKNOWN',
      description: event?.description ?? null,
      sourceBindings: (event?.sources ?? []).map((source) => ({
        role: source.sourceRole,
        url: source.sourceUrl ?? '',
        connectorId: source.connectorId,
      })),
      ticketProvider: ticketBinding?.sourceUrl ?? null,
      checkedLayers: genreEntry.checkedLayers,
      artistsWithKnownGenreEvidence,
      artistsWithoutKnownGenreEvidence,
      failureReason: failure.reason,
      failureDetail: failure.detail,
    };
  });
}

export function buildGenreUnresolvedAfterIntelligence(input: {
  baseline: GenreUnresolvedBaselineEntry[];
  events: StagingEventSnapshot[];
  genreCoverage: GenreCoverageEntry[];
  lineupCoverage: LineupCoverageEntry[];
  store: ArtistProfileStore;
}): GenreUnresolvedBaselineEntry[] {
  const stillUnresolved = input.genreCoverage.filter(
    (entry) => entry.classification === 'GENRE_UNRESOLVED_NO_EVIDENCE',
  );
  return stillUnresolved.map((genreEntry) => {
    const prior = input.baseline.find((item) => item.canonicalEventId === genreEntry.eventId);
    const event = input.events.find((item) => item.eventId === genreEntry.eventId);
    const lineup = input.lineupCoverage.find((item) => item.eventId === genreEntry.eventId);
    const lineupActs = lineup?.currentLineup ?? event?.lineup ?? [];
    const artistsWithKnownGenreEvidence: string[] = [];
    const artistsWithoutKnownGenreEvidence: string[] = [];
    for (const act of lineupActs) {
      const profile = input.store.getProfile(act);
      if (profile && profile.canonicalGenres.length > 0 && profile.confidence !== 'CONFLICT') {
        artistsWithKnownGenreEvidence.push(act);
      } else {
        artistsWithoutKnownGenreEvidence.push(act);
      }
    }
    const checkedLayers = [...new Set([...(prior?.checkedLayers ?? []), ...genreEntry.checkedLayers, 'artist_intelligence'])];
    let failureReason: ArtistUnresolvedReason = 'GENUINELY_UNRESOLVED';
    let failureDetail = genreEntry.reason ?? 'evidence_layers_exhausted_after_artist_intelligence';
    if (lineupActs.length === 0) {
      failureReason = 'LINEUP_INCOMPLETE';
      failureDetail = 'no_verified_lineup_after_intelligence_pass';
    } else if (artistsWithKnownGenreEvidence.length === 0) {
      failureReason = 'ARTIST_METADATA_MISSING';
      failureDetail = 'artist_intelligence_layer_exhausted_without_publishable_profiles';
    } else if (artistsWithKnownGenreEvidence.length < lineupActs.length) {
      failureDetail = `lineup_consensus_below_threshold_${artistsWithKnownGenreEvidence.length}/${lineupActs.length}_classified`;
    }
    return {
      canonicalEventId: genreEntry.eventId,
      title: genreEntry.title,
      date: event?.startsAt ?? null,
      venue: event?.venueName ?? null,
      city: event?.venueCity ?? null,
      organizer: event?.organizerName ?? null,
      currentGenres: genreEntry.currentGenres,
      lineup: lineupActs,
      lineupCompleteness: lineup?.classification ?? 'UNKNOWN',
      description: event?.description ?? null,
      sourceBindings: (event?.sources ?? []).map((source) => ({
        role: source.sourceRole,
        url: source.sourceUrl ?? '',
        connectorId: source.connectorId,
      })),
      ticketProvider: event?.sources.find((source) => source.sourceRole === 'ticket')?.sourceUrl ?? null,
      checkedLayers: checkedLayers,
      artistsWithKnownGenreEvidence,
      artistsWithoutKnownGenreEvidence,
      failureReason,
      failureDetail,
    };
  });
}
