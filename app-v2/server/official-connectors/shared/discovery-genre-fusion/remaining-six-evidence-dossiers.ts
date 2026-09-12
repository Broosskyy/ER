import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import type { GenreCoverageEntry } from '../../ticket-evidence/network-discovery/genre-coverage-audit';
import type { LineupCoverageEntry } from '../../ticket-evidence/network-discovery/lineup-coverage-audit';
import type { ArtistProfileStore } from '../artist-genre-intelligence/artist-profile-store';
import { extractHeadlinerFromTitle, getArtistIdentityKey, toArtistSearchName } from '../artist-genre-intelligence/artist-identity';
import type { ProviderNegativeCache } from '../artist-genre-intelligence/provider-negative-cache';
import { collectLineupEvidence, loadEventSourcePayloads } from '../staging-source-evidence';
import type { DiscoverySignalBundle } from './types';
import type { EventGenreFusionResult } from './event-genre-fusion';

export interface RemainingEventEvidenceDossier {
  eventId: string;
  title: string;
  date: string | null;
  venue: string | null;
  domainClassification: string;
  discoveryRelevanceEvidence: string[];
  lineup: string[];
  headliners: string[];
  artistIdentities: Array<{ name: string; identityKey: string; searchName: string }>;
  sourceBindings: Array<{ role: string; url: string }>;
  eventDescriptionEvidence: string[];
  ticketEvidence: string[];
  seriesEvidence: string[];
  promoterEvidence: string[];
  musicBrainzResult: string | null;
  discogsResult: string | null;
  wikipediaResult: string | null;
  officialWebResult: string | null;
  historicalEternalRaveEvidence: string[];
  providerFailures: string[];
  rateLimits: string[];
  timeouts: string[];
  identityMismatch: string[];
  cacheResult: string;
  candidateGenres: string[];
  confidence: string;
  blockingReason: string;
  importEligibilityReview: boolean;
}

export function buildRemainingSixEvidenceDossiers(input: {
  events: StagingEventSnapshot[];
  genreCoverage: GenreCoverageEntry[];
  lineupCoverage: LineupCoverageEntry[];
  discoveryByEventId: Map<string, DiscoverySignalBundle>;
  fusionResults: EventGenreFusionResult[];
  runQuery: LinkedQueryExecutor;
  store: ArtistProfileStore;
  negativeCache: ProviderNegativeCache;
}): RemainingEventEvidenceDossier[] {
  const unresolvedIds = new Set(
    input.genreCoverage
      .filter((entry) => entry.classification === 'GENRE_UNRESOLVED_NO_EVIDENCE')
      .map((entry) => entry.eventId),
  );

  return input.events
    .filter((event) => unresolvedIds.has(event.eventId))
    .map((event) => {
      const discovery = input.discoveryByEventId.get(event.eventId);
      const fusion = input.fusionResults.find((entry) => entry.eventId === event.eventId);
      const sourceRows = loadEventSourcePayloads(input.runQuery, event.eventId);
      const { lineup } = collectLineupEvidence(event, sourceRows);
      const headliner = extractHeadlinerFromTitle(event.title);
      const headliners = headliner ? [headliner] : lineup.length === 1 ? [lineup[0]!] : [];

      const artistIdentities = [...new Set([...lineup, ...headliners])].map((name) => ({
        name,
        identityKey: getArtistIdentityKey(name),
        searchName: toArtistSearchName(name),
      }));

      const providerFailures: string[] = [];
      const rateLimits: string[] = [];
      const timeouts: string[] = [];
      const identityMismatch: string[] = [];
      const historicalEternalRaveEvidence: string[] = [];
      const mbResults: string[] = [];
      const discogsResults: string[] = [];
      const wikiResults: string[] = [];
      const webResults: string[] = [];

      for (const artist of artistIdentities) {
        const profile = input.store.getProfile(artist.name);
        if (profile && profile.canonicalGenres.length > 0) {
          historicalEternalRaveEvidence.push(
            `${artist.name}: ${profile.canonicalGenres.map((g) => g.displayName).join(', ')}`,
          );
        }
        for (const evidence of profile?.genreEvidence ?? []) {
          if (evidence.sourceType === 'MUSICBRAINZ') {
            mbResults.push(`${artist.name}: ${evidence.displayName}`);
          }
          if (evidence.sourceType === 'DISCOGS') {
            discogsResults.push(`${artist.name}: ${evidence.displayName}`);
          }
          if (evidence.sourceReference.startsWith('wikipedia:')) {
            wikiResults.push(`${artist.name}: ${evidence.displayName}`);
          }
          if (evidence.classificationReason.includes('official_artist_web')) {
            webResults.push(`${artist.name}: ${evidence.displayName}`);
          }
        }
        for (const entry of input.negativeCache.allEntries()) {
          if (entry.artistIdentity !== artist.identityKey) {
            continue;
          }
          if (entry.outcome === 'RATE_LIMITED') {
            rateLimits.push(`${artist.name}/${entry.providerId}`);
          }
          if (entry.outcome === 'TIMEOUT') {
            timeouts.push(`${artist.name}/${entry.providerId}`);
          }
          if (entry.outcome === 'TEMPORARY_FAILURE') {
            providerFailures.push(`${artist.name}/${entry.providerId}: ${entry.detail ?? 'temporary'}`);
          }
          if (entry.outcome === 'IDENTITY_UNRESOLVED') {
            identityMismatch.push(`${artist.name}/${entry.providerId}`);
          }
        }
      }

      const ticketSource = event.sources.find((source) => source.sourceRole === 'ticket');
      const seriesEvidence =
        fusion?.contributions.filter((entry) => entry.layer === 'EVENT_SERIES').map((entry) => entry.displayName) ??
        [];

      let blockingReason = 'evidence_layers_exhausted_without_genre';
      if (artistIdentities.length === 0) {
        blockingReason = 'no_lineup_or_headliner_to_classify';
      } else if (historicalEternalRaveEvidence.length === 0 && rateLimits.length > 0) {
        blockingReason = 'provider_rate_limited_before_evidence_collected';
      } else if (historicalEternalRaveEvidence.length === 0) {
        blockingReason = 'artist_metadata_missing_for_all_lineup_acts';
      }

      return {
        eventId: event.eventId,
        title: event.title,
        date: event.startsAt ?? null,
        venue: event.venueName,
        domainClassification: fusion?.domainClassification ?? discovery?.domainClassification ?? 'AMBIGUOUS',
        discoveryRelevanceEvidence: discovery?.relevance.reasons ?? [],
        lineup,
        headliners,
        artistIdentities,
        sourceBindings: event.sources.map((source) => ({
          role: source.sourceRole,
          url: source.sourceUrl,
        })),
        eventDescriptionEvidence: discovery?.genreCandidates.map((c) => c.label) ?? [],
        ticketEvidence: ticketSource ? [ticketSource.sourceUrl] : [],
        seriesEvidence,
        promoterEvidence: event.organizerName ? [event.organizerName] : [],
        musicBrainzResult: mbResults.length > 0 ? mbResults.join('; ') : null,
        discogsResult: discogsResults.length > 0 ? discogsResults.join('; ') : null,
        wikipediaResult: wikiResults.length > 0 ? wikiResults.join('; ') : null,
        officialWebResult: webResults.length > 0 ? webResults.join('; ') : null,
        historicalEternalRaveEvidence,
        providerFailures,
        rateLimits,
        timeouts,
        identityMismatch,
        cacheResult: negativeCacheSummary(input.negativeCache, artistIdentities),
        candidateGenres: fusion?.recommendedGenres ?? [],
        confidence: fusion?.genreConfidence ?? 'UNRESOLVED',
        blockingReason,
        importEligibilityReview: fusion?.importEligibilityReview ?? false,
      };
    });
}

function negativeCacheSummary(
  cache: ProviderNegativeCache,
  artists: Array<{ name: string; identityKey: string }>,
): string {
  const audit = cache.audit();
  const artistKeys = new Set(artists.map((artist) => artist.identityKey));
  const relevant = cache.allEntries().filter((entry) => artistKeys.has(entry.artistIdentity));
  return `global=${audit.total} active=${audit.activeBlocks} relevant=${relevant.length}`;
}
