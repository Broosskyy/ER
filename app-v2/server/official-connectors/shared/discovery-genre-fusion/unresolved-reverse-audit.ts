import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import type { GenreCoverageEntry } from '../../ticket-evidence/network-discovery/genre-coverage-audit';
import type { LineupCoverageEntry } from '../../ticket-evidence/network-discovery/lineup-coverage-audit';
import type { ArtistProfileStore } from '../artist-genre-intelligence/artist-profile-store';
import { extractHeadlinerFromTitle } from '../artist-genre-intelligence/artist-identity';
import { collectLineupEvidence, loadEventSourcePayloads } from '../staging-source-evidence';
import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import type { DiscoverySignalBundle } from './types';
import type { EventGenreFusionResult } from './event-genre-fusion';

export interface UnresolvedReverseAuditEntry {
  eventId: string;
  title: string;
  howDiscovered: string;
  whyRelevant: string;
  highLikelySignals: string[];
  signalsStillAvailable: boolean;
  signalsDiscardedOnImport: boolean;
  canContributeDomain: boolean;
  canContributeGenre: boolean;
  originalQualificationTooWeak: boolean;
  weakImportQualification: boolean;
  importEligibilityReview: boolean;
  lineupState: string;
  headliner: string | null;
  artistEvidenceAttempted: string[];
  artistEvidenceGaps: string[];
  fusionProjection: string[];
  domainClassification: string;
  recommendedNextEvidence: string[];
}

export function buildUnresolvedReverseAudit(input: {
  events: StagingEventSnapshot[];
  genreCoverage: GenreCoverageEntry[];
  lineupCoverage: LineupCoverageEntry[];
  discoveryByEventId: Map<string, DiscoverySignalBundle>;
  fusionResults: EventGenreFusionResult[];
  runQuery: LinkedQueryExecutor;
  store: ArtistProfileStore;
}): UnresolvedReverseAuditEntry[] {
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
      const lineupEntry = input.lineupCoverage.find((entry) => entry.eventId === event.eventId);
      const sourceRows = loadEventSourcePayloads(input.runQuery, event.eventId);
      const { lineup } = collectLineupEvidence(event, sourceRows);
      const headliner = extractHeadlinerFromTitle(event.title) ?? (lineup.length === 1 ? lineup[0] : null);

      const artistEvidenceAttempted: string[] = [];
      const artistEvidenceGaps: string[] = [];
      for (const act of lineup) {
        const profile = input.store.getProfile(act);
        if (profile && profile.canonicalGenres.length > 0) {
          artistEvidenceAttempted.push(`${act}: ${profile.canonicalGenres.map((g) => g.displayName).join(', ')}`);
        } else {
          artistEvidenceGaps.push(act);
        }
      }
      if (headliner && !lineup.includes(headliner)) {
        const profile = input.store.getProfile(headliner);
        if (profile && profile.canonicalGenres.length > 0) {
          artistEvidenceAttempted.push(`${headliner} (headliner): ${profile.canonicalGenres.map((g) => g.displayName).join(', ')}`);
        } else {
          artistEvidenceGaps.push(`${headliner} (headliner)`);
        }
      }

      const weakImport = discovery?.importQualification === 'WEAK_IMPORT_QUALIFICATION';
      const signalsStillAvailable =
        (discovery?.strongDiscoverySignals.length ?? 0) > 0 ||
        (discovery?.genreCandidates.length ?? 0) > 0 ||
        Boolean(headliner) ||
        lineup.length > 0;

      const nextEvidence: string[] = [];
      if (artistEvidenceGaps.length > 0) {
        nextEvidence.push('artist_external_metadata_or_official_bio');
      }
      if ((discovery?.discoveryGenreLabels.length ?? 0) === 0 && (discovery?.strongDiscoverySignals.length ?? 0) === 0) {
        nextEvidence.push('event_specific_description_or_category');
      }
      if (event.sources.some((source) => /bootshaus\.tv/i.test(source.sourceUrl ?? ''))) {
        nextEvidence.push('bootshaus_official_page_refetch');
      }

      return {
        eventId: event.eventId,
        title: event.title,
        howDiscovered: discovery?.connectorIds.join(', ') || 'staging_import',
        whyRelevant: discovery?.relevance.reasons.join('; ') || 'unknown',
        highLikelySignals: [
          ...(discovery?.strongDiscoverySignals ?? []),
          ...(discovery?.relevance.relevance === 'HIGH_RELEVANCE' ? ['HIGH_RELEVANCE'] : []),
          ...(discovery?.relevance.relevance === 'LIKELY_RELEVANT' ? ['LIKELY_RELEVANT'] : []),
        ],
        signalsStillAvailable,
        signalsDiscardedOnImport: (discovery?.strongDiscoverySignals.length ?? 0) > 0,
        canContributeDomain: Boolean(discovery && discovery.domainClassification !== 'NON_ELECTRONIC'),
        canContributeGenre: (fusion?.recommendedGenres.length ?? 0) > 0,
        originalQualificationTooWeak: weakImport,
        weakImportQualification: weakImport,
        importEligibilityReview: fusion?.importEligibilityReview ?? false,
        lineupState: lineupEntry?.classification ?? 'UNKNOWN',
        headliner,
        artistEvidenceAttempted,
        artistEvidenceGaps,
        fusionProjection: fusion?.recommendedGenres ?? [],
        domainClassification: fusion?.domainClassification ?? 'AMBIGUOUS',
        recommendedNextEvidence: nextEvidence,
      };
    });
}
