import type { GenreConfidenceBand } from '../genre-evidence';
import type { RelevanceEvidenceResult } from '../../ticket-evidence/network-discovery/relevance-evidence';

export type DomainClassification =
  | 'ELECTRONIC_HIGH'
  | 'ELECTRONIC_MEDIUM'
  | 'AMBIGUOUS'
  | 'NON_ELECTRONIC';

export type ImportQualificationClass =
  | 'STRONG_EVENT_SPECIFIC'
  | 'MODERATE_EVENT_SPECIFIC'
  | 'WEAK_IMPORT_QUALIFICATION'
  | 'UNKNOWN';

export type FusionSourceLayer =
  | 'EXPLICIT_EVENT'
  | 'STRUCTURED_SOURCE'
  | 'DESCRIPTION'
  | 'TICKET_METADATA'
  | 'DISCOVERY_RELEVANCE'
  | 'DISCOVERY_GENRE_CANDIDATE'
  | 'ARTIST_INTELLIGENCE'
  | 'LINEUP_CONSENSUS'
  | 'HEADLINER_PROFILE'
  | 'EVENT_SERIES'
  | 'BOOTSHAUS_OFFICIAL'
  | 'DOMAIN_ELECTRONIC';

export interface DiscoverySignalBundle {
  eventId: string;
  relevance: RelevanceEvidenceResult;
  genreCandidates: Array<{ label: string; confidence: string }>;
  importQualification: ImportQualificationClass;
  domainClassification: DomainClassification;
  discoveryGenreLabels: string[];
  strongDiscoverySignals: string[];
  weakDiscoverySignals: string[];
  sourceUrls: string[];
  connectorIds: string[];
}

export interface FusionContribution {
  genreKey: string;
  displayName: string;
  layer: FusionSourceLayer;
  authority: number;
  confidence: GenreConfidenceBand;
  sourceReference: string;
  classificationReason: string;
  independenceGroup: string;
}

export interface EventGenreFusionResult {
  eventId: string;
  title: string;
  domainClassification: DomainClassification;
  importQualification: ImportQualificationClass;
  contributions: FusionContribution[];
  recommendedGenres: string[];
  genreConfidence: GenreConfidenceBand;
  classificationMethod: string;
  changedFromCurrent: boolean;
  importEligibilityReview: boolean;
}

export interface GenreFusionContext {
  discoveryByEventId: Map<string, DiscoverySignalBundle>;
  bootshausGenresByEventId: Map<string, string[]>;
  seriesGenresByEventId: Map<string, string[]>;
}

export const FUSION_AUTHORITY: Record<FusionSourceLayer, number> = {
  EXPLICIT_EVENT: 100,
  STRUCTURED_SOURCE: 95,
  BOOTSHAUS_OFFICIAL: 88,
  DESCRIPTION: 82,
  TICKET_METADATA: 80,
  DISCOVERY_GENRE_CANDIDATE: 78,
  HEADLINER_PROFILE: 76,
  LINEUP_CONSENSUS: 72,
  ARTIST_INTELLIGENCE: 70,
  DISCOVERY_RELEVANCE: 65,
  EVENT_SERIES: 55,
  DOMAIN_ELECTRONIC: 35,
};
