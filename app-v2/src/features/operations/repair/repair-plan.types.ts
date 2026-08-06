export const REPAIR_PLAN_VERSION = '1.0.0';

export const REPAIR_SAFETY_VALUES = [
  'safe_read_only_plan',
  'blocked_manual_lock',
  'blocked_missing_provenance',
  'blocked_schema_gap',
  'review_required',
  'unsupported',
] as const;

export type RepairSafety = (typeof REPAIR_SAFETY_VALUES)[number];

export type RepairPlanEntityType = 'event' | 'origin' | 'relationship' | 'cache';

export interface RepairPlanChange {
  entityType: RepairPlanEntityType;
  entityId: string;
  fieldOrRelationship: string;
  currentValue?: unknown;
  proposedValue?: unknown;
  reason: string;
  sourceId?: string;
  originId?: string;
  importRecordId?: string;
  confidence?: number;
  trustTier?: string;
  freshness?: string;
  safety: RepairSafety;
  fingerprint: string;
  recordFingerprint: string;
}

export interface RepairPlanRecordSnapshot {
  entityType: RepairPlanEntityType;
  entityId: string;
  fingerprint: string;
  updatedAt?: string;
  importRecordUpdatedAt?: string;
}

export interface RepairPlan {
  planVersion: string;
  planId: string;
  repairVersion: string;
  generatedAt: string;
  environment: string;
  projectId: string;
  commit?: string;
  schemaWatermark: string;
  connectorVersions: Record<string, string>;
  parserVersions: Record<string, string>;
  sourceIds: string[];
  eventIds: string[];
  datasetFingerprint: string;
  recordSnapshots: RepairPlanRecordSnapshot[];
  changes: RepairPlanChange[];
  safetyAssertions: string[];
  summary: RepairPlanSummary;
  changeChecksum: string;
  checksum: string;
}

export interface RepairPlanSummary {
  proposedCount: number;
  blockedCount: number;
  reviewRequiredCount: number;
  totalChanges: number;
}

export interface RepairPreflightTotals {
  publishedEvents: number;
  staleEvents: number;
  eventsWithImportRecords: number;
  activeImportJobs: number;
  parityIssues: number;
}

export interface RepairPreflightResult {
  ok: boolean;
  mode: 'preflight' | 'plan' | 'validate' | 'post-audit';
  environment: string;
  projectId: string;
  schemaWatermark: string;
  repairVersion: string;
  generatedAt: string;
  totals: RepairPreflightTotals;
  blockedReasons: string[];
  warnings: string[];
}

export interface RepairPlanBuildResult {
  plan: RepairPlan | null;
  preflight: RepairPreflightResult;
  artifactPath?: string;
}

export type RepairPlanValidationCode =
  | 'checksum_invalid'
  | 'change_checksum_invalid'
  | 'environment_mismatch'
  | 'project_mismatch'
  | 'schema_watermark_stale'
  | 'repair_version_stale'
  | 'record_fingerprint_stale'
  | 'import_record_stale'
  | 'active_import_jobs'
  | 'unsupported_safety_state'
  | 'manual_lock_blocked'
  | 'missing_provenance_blocked'
  | 'plan_version_unsupported';

export interface RepairPlanValidationIssue {
  code: RepairPlanValidationCode;
  message: string;
  entityId?: string;
  fieldOrRelationship?: string;
}

export interface RepairPlanValidationResult {
  valid: boolean;
  planId: string;
  environment: string;
  projectId: string;
  checkedAt: string;
  issues: RepairPlanValidationIssue[];
}

export interface RepairAuditStaleEvent {
  id: string;
  title: string;
  sourceId?: string;
  reasons: string[];
  venueId?: string;
  venueName?: string;
  venueCity?: string;
  lineupCount: number;
  titleArtists: string[];
  externalLocationTitle: boolean;
  importRecordId?: string;
  importRecordUpdatedAt?: string;
}

export interface RepairAuditDataset {
  generatedAt: string;
  publishedEvents: AdminEventSnapshot[];
  staleEvents: RepairAuditStaleEvent[];
  parityIssues: Array<{ id: string; field: string; card?: string; formatted?: string; value?: string }>;
  importRecordsByEventId: Map<string, RepairImportRecordSnapshot>;
  provenanceByEventId: Map<string, Map<string, RepairProvenanceSnapshot>>;
  activeImportJobs: RepairActiveImportJob[];
  sourceIds: string[];
}

export interface AdminEventSnapshot {
  id: string;
  title: string;
  description?: string;
  sourceId?: string;
  venueId?: string;
  venueName?: string;
  venueCity?: string;
  ticketUrl?: string;
  priceText?: string;
  imageUrl?: string;
  organizerName?: string;
  startDate: string;
  endDate?: string;
  updatedAt?: string;
  canonicalEventId?: string;
  artistId?: string;
}

export interface RepairImportRecordSnapshot {
  id: string;
  eventId: string;
  sourceId: string;
  updatedAt?: string;
  normalizedPayload?: Record<string, unknown>;
}

export interface RepairProvenanceSnapshot {
  fieldPath: string;
  selectedSourceId: string;
  selectionReason: string;
  manuallyOverridden: boolean;
  selectedTier?: string;
  lastChangedAt?: string;
}

export interface RepairActiveImportJob {
  id: string;
  sourceId: string;
  status: string;
}
