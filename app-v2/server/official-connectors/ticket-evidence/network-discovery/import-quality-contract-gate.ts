import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import { classifyDomainFromRelevance, classifyImportQualification } from '../../shared/discovery-genre-fusion/domain-classification';
import type { DiscoverySignalBundle } from '../../shared/discovery-genre-fusion/types';
import { evaluateEventQuality } from '../../shared/event-quality/evaluate-event-quality';
import type { EventQualityEvaluation, EventQualityState } from '../../shared/event-quality/types';
import type { EnrichedTicketIoEvent } from './detail-types';
import type { EventCompletenessEntry } from './event-completeness-audit';
import type { GenreCoverageEntry } from './genre-coverage-audit';
import { classifyRelevanceEvidence } from './relevance-evidence';

export interface ImportQualityContractResult {
  identityKey: string;
  title: string;
  domainState: string;
  identityState: string;
  qualityState: EventQualityState;
  titleReady: boolean;
  timeReady: boolean;
  venueReady: boolean;
  genreState: string;
  lineupState: string;
  ticketState: string;
  mediaState: string;
  descriptionState: string;
  reviewReasons: string[];
  passesQualityContract: boolean;
  qualityContractBypass: boolean;
  evaluation: EventQualityEvaluation;
}

function buildSyntheticSnapshot(event: EnrichedTicketIoEvent): StagingEventSnapshot {
  const genres = event.genreCandidates
    .filter((genre) => genre.confidence !== 'weak_inferred')
    .map((genre) => genre.label);

  return {
    eventId: `candidate:${event.identityKey}`,
    title: event.title,
    description: event.description ?? null,
    startsAt: event.startsAt ?? '',
    endsAt: event.endsAt ?? null,
    status: 'published',
    imageUrl: event.bestMediaUrl ?? null,
    officialUrl: event.canonicalUrl,
    organizerName: event.organizerName ?? null,
    venueId: null,
    venueName: event.venueName ?? null,
    venueCity: event.city ?? null,
    lineup: event.lineupHints,
    genres,
    sources: [
      {
        sourceId: event.identityKey,
        sourceRole: 'ticket_io',
        sourceUrl: event.eventUrl,
        connectorId: 'ticket-io-network-discovery',
        sourceEventKey: event.identityKey,
      },
    ],
    tickets: event.currentAdmissionPriceMinor != null
      ? [
          {
            ticketId: `${event.identityKey}:admission`,
            provider: 'ticket_io',
            ticketUrl: event.eventUrl,
            priceMinor: event.currentAdmissionPriceMinor,
            currency: 'EUR',
            availability: event.ticketAvailability,
          },
        ]
      : [],
  };
}

function buildCompletenessEntry(event: EnrichedTicketIoEvent, snapshot: StagingEventSnapshot): EventCompletenessEntry {
  const hasDescription = event.descriptionQualification !== 'NO_DESCRIPTION';
  const hasLineup = event.lineupQualification !== 'NO_LINEUP';
  const hasGenre = snapshot.genres.length > 0;
  const hasMedia = Boolean(event.bestMediaUrl);
  const hasTicket = Boolean(event.eventUrl) && event.currentAdmissionPriceMinor != null;

  return {
    eventId: snapshot.eventId,
    title: event.title,
    startsAt: snapshot.startsAt,
    endsAt: snapshot.endsAt,
    venue: snapshot.venueName,
    city: snapshot.venueCity,
    organizer: snapshot.organizerName,
    fields: {
      title: { state: snapshot.title ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE' },
      startsAt: { state: snapshot.startsAt ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE' },
      endsAt: { state: snapshot.endsAt ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE' },
      venue: { state: snapshot.venueName ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE' },
      city: { state: snapshot.venueCity ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE' },
      organizer: { state: snapshot.organizerName ? 'VERIFIED_PARTIAL' : 'UNRESOLVED_NO_EVIDENCE' },
      description: {
        state: hasDescription ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE',
      },
      lineup: {
        state:
          event.lineupQualification === 'FULL_LINEUP'
            ? 'VERIFIED_COMPLETE'
            : event.lineupQualification === 'PARTIAL_LINEUP'
              ? 'VERIFIED_PARTIAL'
              : 'UNRESOLVED_NO_EVIDENCE',
      },
      genres: { state: hasGenre ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE' },
      media: { state: hasMedia ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE' },
      ticketUrl: { state: hasTicket ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE' },
      ticketPrice: {
        state: event.currentAdmissionPriceMinor != null ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE',
      },
      ticketStatus: { state: 'VERIFIED_PARTIAL' },
      sourceBindings: { state: 'VERIFIED_COMPLETE' },
    },
    readiness:
      snapshot.title && snapshot.startsAt && snapshot.venueName
        ? hasGenre
          ? 'DISCOVERY_READY'
          : 'PARTIAL'
        : 'REVIEW_REQUIRED',
  };
}

function buildGenreCoverageEntry(event: EnrichedTicketIoEvent, snapshot: StagingEventSnapshot): GenreCoverageEntry {
  const genres = snapshot.genres;
  return {
    eventId: snapshot.eventId,
    title: event.title,
    sources: ['ticket-io-network-discovery'],
    currentGenres: genres,
    availableGenreEvidence: event.genreCandidates.map((genre) => genre.label),
    evidenceStrength: genres.length > 0 ? 'strong' : event.genreCandidates.length > 0 ? 'weak' : 'none',
    recommendedGenres: event.genreCandidates.map((genre) => genre.label),
    classification:
      genres.length > 0
        ? 'GENRE_VERIFIED'
        : event.genreCandidates.length > 0
          ? 'GENRE_RECOVERABLE'
          : 'GENRE_UNRESOLVED_NO_EVIDENCE',
    checkedLayers: ['ticket_io_detail', 'discovery_genre_candidate'],
    explicitGenreCount: event.genreCandidates.filter((genre) => genre.confidence === 'explicit').length,
    lineupDerivedGenres: [],
    confidenceBand: genres.length > 0 ? 'HIGH' : 'UNRESOLVED',
  };
}

/**
 * Evaluate an enriched import candidate against NEW_EVENT_QUALITY_CONTRACT before publication.
 */
export function evaluateImportCandidateQualityContract(
  event: EnrichedTicketIoEvent,
): ImportQualityContractResult {
  const relevanceEvidence = classifyRelevanceEvidence({
    title: event.title,
    description: event.description,
    genreHints: event.genreHints,
    lineupHints: event.lineupHints,
    venueName: event.venueName,
    organizerName: event.organizerName,
    detailAccess: event.detailAccess,
  });

  const domainClassification = classifyDomainFromRelevance(relevanceEvidence);
  const importQualification = classifyImportQualification({
    relevance: relevanceEvidence,
    hasTicketBinding: Boolean(event.eventUrl),
    hasOfficialBinding: event.verifiedOutbound.some((source) => source.verified),
    genreCandidateCount: event.genreCandidates.length,
  });

  const snapshot = buildSyntheticSnapshot(event);
  const discovery: DiscoverySignalBundle = {
    eventId: snapshot.eventId,
    relevance: relevanceEvidence,
    genreCandidates: event.genreCandidates.map((genre) => ({
      label: genre.label,
      confidence: genre.confidence,
    })),
    importQualification,
    domainClassification,
    discoveryGenreLabels: event.genreCandidates.map((genre) => genre.label),
    strongDiscoverySignals: relevanceEvidence.strongPositiveHits,
    weakDiscoverySignals: relevanceEvidence.weakPositiveHits,
    sourceUrls: [event.eventUrl],
    connectorIds: ['ticket-io-network-discovery'],
  };

  const evaluation = evaluateEventQuality({
    event: snapshot,
    discovery,
    genreCoverage: buildGenreCoverageEntry(event, snapshot),
    completeness: buildCompletenessEntry(event, snapshot),
  });

  const titleReady = evaluation.identity.state === 'VERIFIED';
  const timeReady = Boolean(snapshot.startsAt);
  const venueReady = Boolean(snapshot.venueName);

  const passesQualityContract =
    evaluation.qualityState === 'READY' || evaluation.qualityState === 'READY_WITH_WARNINGS';

  return {
    identityKey: event.identityKey,
    title: event.title,
    domainState: domainClassification,
    identityState: event.matchClassification,
    qualityState: evaluation.qualityState,
    titleReady,
    timeReady,
    venueReady,
    genreState: evaluation.genre.state.state,
    lineupState: evaluation.lineup.state,
    ticketState: evaluation.ticket.state,
    mediaState: evaluation.media.state,
    descriptionState: evaluation.description.state,
    reviewReasons: evaluation.reviewReasons,
    passesQualityContract,
    qualityContractBypass: false,
    evaluation,
  };
}

export function summarizeQualityContractResults(
  results: ImportQualityContractResult[],
): {
  qualityContractEvaluated: number;
  qualityContractBypass: number;
  ready: number;
  readyWithWarnings: number;
  reviewRequired: number;
  rejected: number;
} {
  return {
    qualityContractEvaluated: results.length,
    qualityContractBypass: results.filter((result) => result.qualityContractBypass).length,
    ready: results.filter((result) => result.qualityState === 'READY').length,
    readyWithWarnings: results.filter((result) => result.qualityState === 'READY_WITH_WARNINGS').length,
    reviewRequired: results.filter((result) => result.qualityState === 'REVIEW_REQUIRED').length,
    rejected: results.filter((result) => result.qualityState === 'REJECTED').length,
  };
}
