import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { collectLineupEvidence, loadEventSourcePayloads } from '../staging-source-evidence';
import {
  eventDescriptionProvider,
  historicalEventProvider,
  runArtistEvidenceProviders,
} from './artist-evidence-providers';
import { fetchExternalArtistGenreEvidence } from './external-metadata-provider';
import { getArtistIdentityKey } from './artist-identity';
import {
  buildEventGenreExplanation,
  deriveEventGenresFromLineupConsensus,
} from './lineup-genre-consensus';
import { ArtistProfileStore } from './artist-profile-store';
import type { ArtistGenreEvidence, EventGenreExplanation } from './types';

export interface ArtistIntelligenceDryRunResult {
  artistProfilesCreated: number;
  artistProfilesReused: number;
  artistsEvaluated: number;
  artistsClassified: number;
  artistsUnresolved: number;
  artistGenreConflicts: number;
  eventsRecoveredByArtistIntelligence: number;
  lineupConsensus: Array<{
    eventId: string;
    title: string;
    genres: string[];
    classifiedArtists: number;
    unclassifiedArtists: number;
    genreDistribution: Record<string, number>;
  }>;
  explanations: EventGenreExplanation[];
}

function collectUniqueLineupArtists(events: StagingEventSnapshot[], runQuery?: LinkedQueryExecutor): string[] {
  const artists = new Set<string>();
  for (const event of events) {
    const sourceRows = runQuery ? loadEventSourcePayloads(runQuery, event.eventId) : [];
    const { lineup } = collectLineupEvidence(event, sourceRows);
    for (const act of lineup) {
      artists.add(act);
    }
  }
  return [...artists].sort();
}

export async function runArtistIntelligencePass(input: {
  events: StagingEventSnapshot[];
  runQuery?: LinkedQueryExecutor;
  store: ArtistProfileStore;
  fetchExternal?: boolean;
}): Promise<ArtistIntelligenceDryRunResult> {
  input.store.load();
  const artistNames = collectUniqueLineupArtists(input.events, input.runQuery);
  let artistProfilesReused = 0;
  for (const artistName of artistNames) {
    if (input.store.getProfile(artistName)) {
      artistProfilesReused += 1;
    }
  }

  const localProviders = [historicalEventProvider, eventDescriptionProvider];
  const evidenceByArtist = await runArtistEvidenceProviders({
    artistNames,
    events: input.events,
    runQuery: input.runQuery,
    store: input.store,
    providers: localProviders,
  });

  let artistProfilesCreated = 0;
  for (const artistName of artistNames) {
    const identity = getArtistIdentityKey(artistName);
    const evidence = evidenceByArtist.get(identity) ?? [];
    if (evidence.length > 0) {
      const hadProfile = Boolean(input.store.getProfile(artistName));
      input.store.upsertEvidence(artistName, evidence);
      if (!hadProfile) {
        artistProfilesCreated += 1;
      }
    }
  }

  if (input.fetchExternal) {
    for (const artistName of artistNames) {
      const profile = input.store.getProfile(artistName);
      if (profile && profile.canonicalGenres.length > 0) {
        continue;
      }
      const externalEvidence = await fetchExternalArtistGenreEvidence(artistName);
      input.store.recordProviderRequest(
        'external-metadata',
        externalEvidence.length > 0 ? 'success' : 'failure',
      );
      if (externalEvidence.length === 0) {
        continue;
      }
      const hadProfile = Boolean(profile);
      input.store.upsertEvidence(artistName, externalEvidence);
      if (!hadProfile) {
        artistProfilesCreated += 1;
      }
    }
  }

  const lineupConsensus: ArtistIntelligenceDryRunResult['lineupConsensus'] = [];
  const explanations: EventGenreExplanation[] = [];
  let eventsRecovered = 0;

  for (const event of input.events) {
    const sourceRows = input.runQuery ? loadEventSourcePayloads(input.runQuery, event.eventId) : [];
    const { lineup } = collectLineupEvidence(event, sourceRows);
    const consensus = deriveEventGenresFromLineupConsensus({
      eventId: event.eventId,
      title: event.title,
      lineup,
      store: input.store,
    });
    lineupConsensus.push({
      eventId: event.eventId,
      title: event.title,
      genres: consensus.genres.map((genre) => genre.displayName),
      classifiedArtists: consensus.classifiedArtists,
      unclassifiedArtists: consensus.unclassifiedArtists,
      genreDistribution: consensus.genreDistribution,
    });
    explanations.push(
      buildEventGenreExplanation({
        eventId: event.eventId,
        title: event.title,
        consensus,
      }),
    );
    if (event.genres.length === 0 && consensus.genres.length > 0) {
      eventsRecovered += 1;
    }
  }

  const profiles = input.store.allProfiles();
  const artistsClassified = profiles.filter((profile) => profile.canonicalGenres.length > 0).length;
  const artistsUnresolved = artistNames.length - artistsClassified;
  const artistGenreConflicts = profiles.filter((profile) => profile.confidence === 'CONFLICT').length;

  input.store.save();

  return {
    artistProfilesCreated,
    artistProfilesReused,
    artistsEvaluated: artistNames.length,
    artistsClassified,
    artistsUnresolved,
    artistGenreConflicts,
    eventsRecoveredByArtistIntelligence: eventsRecovered,
    lineupConsensus,
    explanations,
  };
}

export function artistEvidenceRecords(store: ArtistProfileStore): ArtistGenreEvidence[] {
  return store.allProfiles().flatMap((profile) => profile.genreEvidence);
}
