import type { GenreConfidenceBand } from '../genre-evidence';
import type { DomainClassification } from '../discovery-genre-fusion/types';
import type { EventReadinessState } from '../../ticket-evidence/network-discovery/event-completeness-audit';

export type QualityRequirementClass =
  | 'REQUIRED_FOR_PUBLICATION'
  | 'REQUIRED_IF_EVIDENCE_EXISTS'
  | 'BEST_EFFORT'
  | 'REVIEW_REQUIRED';

export type EventQualityState =
  | 'READY'
  | 'READY_WITH_WARNINGS'
  | 'REVIEW_REQUIRED'
  | 'REJECTED'
  | 'QUARANTINED';

export interface FieldQualityAssessment {
  requirementClass: QualityRequirementClass;
  state: 'VERIFIED' | 'PARTIAL' | 'MISSING' | 'INVALID' | 'REVIEW';
  valuePresent: boolean;
  provenancePresent: boolean;
  reason?: string;
}

export interface EventQualityEvaluation {
  domain: {
    classification: DomainClassification;
    state: FieldQualityAssessment;
  };
  identity: FieldQualityAssessment;
  completeness: FieldQualityAssessment;
  genre: {
    state: FieldQualityAssessment;
    genres: string[];
    confidence: GenreConfidenceBand;
    coverageEligible: boolean;
  };
  lineup: FieldQualityAssessment;
  ticket: FieldQualityAssessment;
  media: FieldQualityAssessment;
  description: FieldQualityAssessment;
  qualityState: EventQualityState;
  reviewReasons: string[];
  provenance: Array<{ field: string; sourceReference: string; authority: string }>;
  readiness: EventReadinessState;
}

export interface SourceQualityProfile {
  sourceKey: string;
  candidatesSeen: number;
  domainQualified: number;
  canonicalCreated: number;
  canonicalMatched: number;
  duplicateRate: number;
  genreCoverage: number;
  lineupCoverage: number;
  ticketTargetCoverage: number;
  ticketPriceCoverage: number;
  mediaCoverage: number;
  descriptionCoverage: number;
  reviewRate: number;
  invalidRate: number;
}

export interface BatchQualitySummary {
  candidatesSeen: number;
  domainElectronicHigh: number;
  domainElectronicMedium: number;
  domainAmbiguous: number;
  domainNonElectronic: number;
  canonicalCreated: number;
  canonicalMatched: number;
  duplicateCandidates: number;
  publishedEligible: number;
  genreClassified: number;
  genreUnresolved: number;
  genreCoverage: number;
  lineupComplete: number;
  lineupPartial: number;
  lineupNotAnnounced: number;
  ticketVerified: number;
  ticketUnsafe: number;
  ticketUnavailable: number;
  mediaQualified: number;
  mediaMissing: number;
  descriptionQualified: number;
  descriptionMissing: number;
  reviewRequired: number;
  rejected: number;
}
