import type { EvidenceReviewState, EvidenceType, SourceRole, SupportedEventDomain } from './evidence-types';

export interface FieldEvidenceCandidate {
  fieldName: SupportedEventDomain | string;
  rawValue: unknown;
  normalizedValue: unknown;
  sourceId: string;
  sourceRole: SourceRole;
  originUrl: string;
  evidenceType: EvidenceType;
  extractionStrategy: string;
  observedAt: string;
  importerVersion: string;
  confidence: number;
  reliability: number;
  eventIdentityMatch?: string;
  reviewState: EvidenceReviewState;
  inclusionReason: string;
  rejectionReason?: string;
  explicit: boolean;
}

export function createFieldEvidenceCandidate(
  input: Omit<FieldEvidenceCandidate, 'explicit'> & { explicit?: boolean },
): FieldEvidenceCandidate {
  return {
    ...input,
    explicit: input.explicit ?? input.evidenceType !== 'inferred_candidate',
  };
}
