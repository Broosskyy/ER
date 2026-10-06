import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import type { DiscoverySignalBundle } from './types';

export interface DiscoveryProvenanceEntry {
  eventId: string;
  title: string;
  source: string[];
  shop: string | null;
  discoveryCandidate: boolean;
  relevanceScore: string;
  relevanceClassification: string;
  relevanceSignals: string[];
  strongSignals: string[];
  weakSignals: string[];
  eventTitleSignals: string[];
  descriptionSignals: string[];
  categorySignals: string[];
  lineupSignals: string[];
  shopSignals: string[];
  sourceNetworkSignals: string[];
  ticketMetadata: string[];
  mediaSignals: string[];
  existingCanonicalGenres: string[];
  domainClassification: string;
  importQualification: string;
  discoveryGenreLabels: string[];
}

export function buildDiscoveryProvenanceAudit(
  events: StagingEventSnapshot[],
  discoveryByEventId: Map<string, DiscoverySignalBundle>,
): DiscoveryProvenanceEntry[] {
  return events.map((event) => {
    const discovery = discoveryByEventId.get(event.eventId);
    const ticketSource = event.sources.find((source) => source.sourceRole === 'ticket');
    const officialSource = event.sources.find((source) => source.sourceRole === 'official');
    return {
      eventId: event.eventId,
      title: event.title,
      source: event.sources.map((source) => source.connectorId ?? source.sourceRole),
      shop: ticketSource?.sourceUrl?.match(/https?:\/\/([^/]+)/)?.[1] ?? null,
      discoveryCandidate: Boolean(ticketSource),
      relevanceScore: discovery?.relevance.relevance ?? 'UNKNOWN',
      relevanceClassification: discovery?.relevance.relevance ?? 'UNKNOWN',
      relevanceSignals: discovery?.relevance.reasons ?? [],
      strongSignals: discovery?.strongDiscoverySignals ?? [],
      weakSignals: discovery?.weakDiscoverySignals ?? [],
      eventTitleSignals: discovery?.relevance.strongPositiveHits.filter((hit) =>
        new RegExp(hit.replace(/_/g, '[\\s_-]*'), 'i').test(event.title),
      ) ?? [],
      descriptionSignals: discovery?.genreCandidates.map((candidate) => candidate.label) ?? [],
      categorySignals: discovery?.genreCandidates
        .filter((candidate) => candidate.confidence === 'explicit')
        .map((candidate) => candidate.label) ?? [],
      lineupSignals: [],
      shopSignals: discovery?.weakDiscoverySignals.filter((hit) => hit === 'club' || hit === 'night') ?? [],
      sourceNetworkSignals: discovery?.connectorIds ?? [],
      ticketMetadata: ticketSource ? [ticketSource.sourceUrl] : [],
      mediaSignals: officialSource ? [officialSource.sourceUrl] : [],
      existingCanonicalGenres: event.genres,
      domainClassification: discovery?.domainClassification ?? 'AMBIGUOUS',
      importQualification: discovery?.importQualification ?? 'UNKNOWN',
      discoveryGenreLabels: discovery?.discoveryGenreLabels ?? [],
    };
  });
}
