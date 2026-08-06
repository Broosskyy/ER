export const TRUST_QUALITY_DECISIONS = [
  'auto_publish',
  'review_required',
  'hold',
  'reject',
] as const;

export type TrustQualityDecision = (typeof TRUST_QUALITY_DECISIONS)[number];

export const TRUST_RULE_CATEGORIES = [
  'field_required',
  'plausibility',
  'duplicate',
  'trust',
  'url',
  'conflict',
] as const;

export type TrustRuleCategory = (typeof TRUST_RULE_CATEGORIES)[number];

export const TRUST_RULE_SEVERITIES = ['blocking', 'warning', 'info'] as const;
export type TrustRuleSeverity = (typeof TRUST_RULE_SEVERITIES)[number];

export const TRUST_RULE_DECISION_IMPACTS = [
  'reject',
  'hold',
  'review_required',
  'none',
] as const;

export type TrustRuleDecisionImpact = (typeof TRUST_RULE_DECISION_IMPACTS)[number];

export interface TrustQualityRule {
  id: string;
  ruleKey: string;
  category: TrustRuleCategory;
  severity: TrustRuleSeverity;
  decisionImpact: TrustRuleDecisionImpact;
  enabled: boolean;
  weight: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TrustQualityRuleViolation {
  ruleId: string;
  ruleKey: string;
  category: TrustRuleCategory;
  severity: TrustRuleSeverity;
  decisionImpact: TrustRuleDecisionImpact;
  message: string;
  affectedFields: string[];
}

export interface ImportRecordQualityResult {
  score: number;
  tier: 'A' | 'B' | 'C' | 'D';
  completeness: number;
  missingFields: string[];
  blockingIssues: string[];
  warnings: string[];
  violations: TrustQualityRuleViolation[];
  calculatedAt: string;
}

export interface TrustPublishEvaluation {
  decision: TrustQualityDecision;
  qualityScore: number;
  trustScore: number;
  reasons: string[];
  affectedFields: string[];
  ruleIds: string[];
  violations: TrustQualityRuleViolation[];
  quality: ImportRecordQualityResult;
}

export type ImportReviewQueueStatus = 'pending' | 'on_hold' | 'approved' | 'rejected' | 'expired';

export const IMPORT_REVIEW_RESOLUTION_REASONS = {
  evaluationImprovedToAutoPublish: 'evaluation_improved_to_auto_publish',
  publishFailed: 'publish_failed',
  matchResolvedOnPublishedRecord: 'match_resolved_on_published_record',
  matchResolvedAutoLink: 'match_resolved_auto_link',
  lifecycleResolvedOnPublishSuccess: 'lifecycle_resolved_on_publish_success',
  lifecycleResolvedIgnored: 'lifecycle_resolved_ignored',
  stablePublishedRecordReimport: 'stable_published_record_reimport',
  importedRecordPublished: 'imported_record_published',
  testArtifactResolved: 'test_artifact_resolved',
} as const;

export type ImportReviewResolutionReason =
  (typeof IMPORT_REVIEW_RESOLUTION_REASONS)[keyof typeof IMPORT_REVIEW_RESOLUTION_REASONS];

export type ImportReviewReconcileAction = 'none' | 'created' | 'updated' | 'closed';

export interface ImportReviewReconcileResult {
  action: ImportReviewReconcileAction;
  entry: ImportReviewQueueEntry | null;
}

export interface ImportReviewQueueEntry {
  id: string;
  importRecordId: string;
  importJobId?: string;
  sourceId: string;
  externalEventId: string;
  status: ImportReviewQueueStatus;
  decision: TrustQualityDecision;
  qualityScore?: number;
  trustScore?: number;
  reasons: string[];
  affectedFields: string[];
  ruleIds: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type SourceReputationEventType =
  | 'import_success'
  | 'import_failure'
  | 'publish_success'
  | 'publish_queued'
  | 'publish_rejected'
  | 'manual_correction'
  | 'quality_improvement'
  | 'quality_regression';

export interface SourceReputationEvent {
  id: string;
  sourceId: string;
  eventType: SourceReputationEventType;
  delta: number;
  previousTrustScore: number;
  newTrustScore: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TrustQualityThresholds {
  minTrustScore: number;
  minExtractionConfidence: number;
  minQualityScoreForAutoPublish: number;
  duplicateThreshold: number;
  rejectTrustScore: number;
  holdTrustScore: number;
}

export interface TrustQualityRuleRepository {
  listEnabled(): Promise<TrustQualityRule[]>;
  listAll(): Promise<TrustQualityRule[]>;
}

export interface ImportReviewQueueRepository {
  upsert(entry: ImportReviewQueueEntry): Promise<ImportReviewQueueEntry>;
  findByImportRecordId(importRecordId: string): Promise<ImportReviewQueueEntry | null>;
  findActiveBySourceAndExternalEventId(
    sourceId: string,
    externalEventId: string,
  ): Promise<ImportReviewQueueEntry | null>;
  listBySourceId(sourceId: string, limit?: number): Promise<ImportReviewQueueEntry[]>;
  listPending(limit?: number): Promise<ImportReviewQueueEntry[]>;
}

export interface SourceReputationRepository {
  create(event: SourceReputationEvent): Promise<SourceReputationEvent>;
  listBySourceId(sourceId: string, limit?: number): Promise<SourceReputationEvent[]>;
}
