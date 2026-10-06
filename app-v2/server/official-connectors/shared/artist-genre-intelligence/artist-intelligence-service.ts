import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { collectLineupEvidence, loadEventSourcePayloads } from '../staging-source-evidence';
import {
  eventDescriptionProvider,
  historicalEventProvider,
  runArtistEvidenceProviders,
} from './artist-evidence-providers';
import { fetchExternalArtistGenreEvidence } from './external-metadata-provider';
import { ProviderNegativeCache } from './provider-negative-cache';
import { fetchWikipediaArtistGenreEvidence } from './wikipedia-artist-provider';
import {
  fetchDiscogsOfficialUrls,
  fetchOfficialArtistWebEvidence,
} from './official-artist-web-provider';
import { toArtistSearchName } from './artist-identity';
import { extractHeadlinerFromTitle, getArtistIdentityKey } from './artist-identity';
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
    const headliner = extractHeadlinerFromTitle(event.title);
    if (headliner) {
      artists.add(headliner);
    }
    const sourceRows = runQuery ? loadEventSourcePayloads(runQuery, event.eventId) : [];
    const { lineup } = collectLineupEvidence(event, sourceRows);
    for (const act of lineup) {
      artists.add(act);
    }
  }
  return [...artists].sort();
}

function prioritizeArtistsForExternalFetch(
  events: StagingEventSnapshot[],
  artistNames: string[],
  runQuery?: LinkedQueryExecutor,
): string[] {
  const unresolvedHeadliners = new Set<string>();
  for (const event of events) {
    if (event.genres.length > 0) {
      continue;
    }
    const headliner = extractHeadlinerFromTitle(event.title);
    if (headliner) {
      unresolvedHeadliners.add(headliner);
    }
    if (!runQuery) {
      continue;
    }
    const sourceRows = loadEventSourcePayloads(runQuery, event.eventId);
    const { lineup } = collectLineupEvidence(event, sourceRows);
    if (lineup.length === 1) {
      unresolvedHeadliners.add(lineup[0]!);
    }
  }
  const prioritized = [
    ...artistNames.filter((name) => unresolvedHeadliners.has(name)),
    ...artistNames.filter((name) => !unresolvedHeadliners.has(name)),
  ];
  return [...new Set(prioritized)];
}

function artistsForUnresolvedEvents(
  events: StagingEventSnapshot[],
  runQuery?: LinkedQueryExecutor,
): Set<string> {
  const targets = new Set<string>();
  for (const event of events) {
    if (event.genres.length > 0) {
      continue;
    }
    const headliner = extractHeadlinerFromTitle(event.title);
    if (headliner) {
      targets.add(headliner);
    }
    if (!runQuery) {
      continue;
    }
    const sourceRows = loadEventSourcePayloads(runQuery, event.eventId);
    const { lineup } = collectLineupEvidence(event, sourceRows);
    for (const act of lineup) {
      targets.add(act);
    }
  }
  return targets;
}

export async function runArtistIntelligencePass(input: {
  events: StagingEventSnapshot[];
  runQuery?: LinkedQueryExecutor;
  store: ArtistProfileStore;
  fetchExternal?: boolean;
  externalUnresolvedOnly?: boolean;
  negativeCache?: ProviderNegativeCache;
  invalidateNegativeCacheForArtists?: string[];
}): Promise<ArtistIntelligenceDryRunResult> {
  if (input.store.allProfiles().length === 0) {
    input.store.load();
  }
  const negativeCache = input.negativeCache ?? new ProviderNegativeCache();
  negativeCache.load();
  const forcedArtistIdentities = new Set(
    (input.invalidateNegativeCacheForArtists ?? []).map((name) => getArtistIdentityKey(name)),
  );
  if (forcedArtistIdentities.size > 0) {
    negativeCache.invalidateForArtists(input.invalidateNegativeCacheForArtists ?? []);
  }
  const artistNames = prioritizeArtistsForExternalFetch(
    input.events,
    collectUniqueLineupArtists(input.events, input.runQuery),
    input.runQuery,
  );
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
    const unresolvedTargets = input.externalUnresolvedOnly
      ? artistsForUnresolvedEvents(input.events, input.runQuery)
      : undefined;
    for (const artistName of artistNames) {
      if (unresolvedTargets && !unresolvedTargets.has(artistName)) {
        continue;
      }
      const profile = input.store.getProfile(artistName);
      if (profile && profile.canonicalGenres.length > 0) {
        continue;
      }
      const forceRetry = forcedArtistIdentities.has(getArtistIdentityKey(artistName));
      const shouldFetchExternal =
        forceRetry ||
        ['musicbrainz', 'discogs'].some((providerId) => negativeCache.shouldFetch(providerId, artistName));
      if (!shouldFetchExternal) {
        continue;
      }
      const external = await fetchExternalArtistGenreEvidence(artistName);
      for (const attempt of external.attempts) {
        negativeCache.record(attempt.providerId, artistName, attempt.outcome, attempt.detail);
        input.store.recordProviderRequest(
          attempt.providerId,
          attempt.outcome === 'EVIDENCE_FOUND'
            ? 'success'
            : attempt.outcome === 'TIMEOUT'
              ? 'timeout'
              : 'failure',
        );
      }
      let mergedEvidence = external.evidence;
      if (mergedEvidence.length === 0 && negativeCache.shouldFetch('wikipedia', artistName)) {
        const wikiEvidence = await fetchWikipediaArtistGenreEvidence(artistName);
        negativeCache.record(
          'wikipedia',
          artistName,
          wikiEvidence.length > 0 ? 'EVIDENCE_FOUND' : 'NO_RESULT',
        );
        input.store.recordProviderRequest(
          'wikipedia',
          wikiEvidence.length > 0 ? 'success' : 'failure',
        );
        mergedEvidence = wikiEvidence;
      }
      if (
        mergedEvidence.length === 0 &&
        (forceRetry || negativeCache.shouldFetch('official-artist-web', artistName))
      ) {
        const searchName = toArtistSearchName(artistName);
        const officialUrls = await fetchDiscogsOfficialUrls(searchName);
        const webEvidence = await fetchOfficialArtistWebEvidence({
          artistName,
          officialUrls,
        });
        negativeCache.record(
          'official-artist-web',
          artistName,
          webEvidence.length > 0 ? 'EVIDENCE_FOUND' : 'NO_RESULT',
        );
        input.store.recordProviderRequest(
          'official-artist-web',
          webEvidence.length > 0 ? 'success' : 'failure',
        );
        mergedEvidence = webEvidence;
      }
      if (mergedEvidence.length === 0) {
        continue;
      }
      const hadProfile = Boolean(profile);
      input.store.upsertEvidence(artistName, mergedEvidence);
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
  negativeCache.save();

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
