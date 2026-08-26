export type EvidenceStrength = 'strong' | 'acceptable' | 'weak' | 'conflicting' | 'unavailable';

export type ReconciliationFieldDecision = 'accept' | 'noop' | 'review_required' | 'reject';

export type ChangeClassification =
  | 'new_event'
  | 'unchanged'
  | 'safe_update'
  | 'destructive_update'
  | 'ambiguous_update'
  | 'source_unavailable'
  | 'parse_degraded'
  | 'review_required';

export type ReconcilableField =
  | 'title'
  | 'description'
  | 'startsAt'
  | 'endsAt'
  | 'venue'
  | 'organizer'
  | 'lineup'
  | 'genres'
  | 'image'
  | 'eventStatus';

export interface FieldProvenanceEntry {
  field: ReconcilableField;
  connectorId?: string;
  sourceUrl?: string;
  observedAt?: string;
  evidenceStrength: EvidenceStrength;
  reconciliationResult: ReconciliationFieldDecision;
  reason: string;
}

export interface FieldReconciliationResult {
  field: ReconcilableField;
  decision: ReconciliationFieldDecision;
  evidenceStrength: EvidenceStrength;
  reason: string;
  destructiveRisk?: boolean;
  preservedExisting?: boolean;
}

export interface ReconciliationEvidenceContext {
  connectorId: string;
  sourceUrl: string;
  observedAt: string;
  enrichmentGaps: string[];
  validationDecision: 'persist_ready' | 'review_required' | 'rejected';
  sourceAvailable: boolean;
  parseDegraded: boolean;
  fingerprintChanged: boolean;
  isNewEvent: boolean;
}

export interface EventReconciliationSummary {
  classification: ChangeClassification;
  fieldDecisions: FieldReconciliationResult[];
  fieldProvenance: FieldProvenanceEntry[];
  reviewRequired: boolean;
  destructiveUpdatesBlocked: number;
  reasons: string[];
}
