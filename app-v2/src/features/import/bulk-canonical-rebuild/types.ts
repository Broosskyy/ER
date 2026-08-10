import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { IdentityPublishVerdict } from '@/features/import/domain/event-evidence-identity-gate';
import type { SourceEvidenceBundle } from '@/features/import/generic-truth-pipeline/source-evidence-contract';

export type BulkRebuildDisposition =
  | 'ready_unchanged'
  | 'ready_update'
  | 'ready_new'
  | 'ready_partial'
  | 'review_identity'
  | 'review_collision'
  | 'review_core_missing'
  | 'review_missing_evidence'
  | 'archive_duplicate'
  | 'archive_stale'
  | 'blocked_contamination'
  | 'review_live_unavailable';

export type IdPreservationDecision =
  | 'preserve_existing_id'
  | 'new_event_id_required'
  | 'duplicate_of_existing'
  | 'no_safe_mapping';

export interface RebuiltCanonicalEvent {
  title?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  venueName?: string;
  venueCity?: string;
  venueAddress?: string;
  venueCountryCode?: string;
  cityName?: string;
  countryCode?: string;
  organizerName?: string;
  websiteUrl?: string;
  description?: string;
  genreLabels?: string[];
  lineupArtistNames?: string[];
  ageRestriction?: string;
  venueEnvironment?: string;
  imageUrl?: string;
  ticketUrl?: string;
  checkoutEvidenceUrl?: string;
  priceText?: string;
  ticketStatus?: AdminEventRecord['ticketStatus'];
  ticketPhases?: AdminEventRecord['ticketPhases'];
  evidenceByFieldGroup: Record<string, string[]>;
  verifiedAt?: string | null;
  identityVerdict?: IdentityPublishVerdict;
  publishCoreSecure?: boolean;
  missingOptionalFields?: string[];
  fieldGroupReadiness?: Record<string, { ready: boolean; missing?: boolean; review?: boolean }>;
}

export interface SourceEvidenceContribution {
  sourceId: string;
  sourceName: string;
  externalId: string;
  candidate: CanonicalImportEvent;
  bundle: SourceEvidenceBundle;
  identityVerdict: IdentityPublishVerdict;
  identityReason: string;
  verifiedAt: string | null;
  mappedEventId?: string;
  mappingMethod?: 'import_record' | 'identity_graph' | 'unmapped';
  detailEvidence?: import('./detail-evidence-types').DetailEvidenceResult;
  embeddedDetailHtml?: string;
}

export interface BulkRebuildEventRow {
  eventIdBefore?: string;
  rowOrigin?: 'identity_cluster' | 'uncovered_horizon_event' | 'orphan_contribution';
  clusterId?: string;
  orphanReason?: string;
  disposition: BulkRebuildDisposition;
  idPreservation: IdPreservationDecision;
  existing?: AdminEventRecord;
  rebuilt: RebuiltCanonicalEvent;
  sourceContributions: SourceEvidenceContribution[];
  changeSet: Record<string, { before: unknown; after: unknown }>;
  consumerBefore?: Record<string, unknown>;
  consumerAfter?: Record<string, unknown>;
  consumerQuality?: {
    publishable: boolean;
    partial: boolean;
    issues: string[];
    checks: Record<string, boolean>;
  };
  collision?: Record<string, unknown>;
  manualLocks: string[];
  duplicateClusterIds?: string[];
  reviewReasons: string[];
  cleanRebuildAudit?: {
    dbFallbackFieldsUsed: string[];
    canonicalSelfDerivedFieldsUsed: string[];
    sourceNativeFieldsUsed: string[];
    missingOptionalFields: string[];
    missingCriticalFields: string[];
  };
}

export interface BulkRebuildMetrics {
  activeSources: number;
  successfulFetches: number;
  fetchErrors: number;
  rawSourceEvents: number;
  normalizedSourceEvents: number;
  identityClusters: number;
  rebuiltCanonicalEvents: number;
  readyUnchanged: number;
  readyUpdate: number;
  readyNew: number;
  readyPartial: number;
  reviewIdentity: number;
  reviewCollision: number;
  reviewMissingEvidence: number;
  reviewCoreMissing: number;
  archiveDuplicate: number;
  archiveStale: number;
  blockedContamination: number;
  consumerFullyReady: number;
  consumerPartial: number;
  consumerNotPublishable: number;
  idPreservationRate: number;
  sourceNativeIdentityCoverage: number;
  verifiedAtCoverage: number;
  contentCoverage: number;
  genreCoverage: number;
  lineupCoverage: number;
  ticketCoverage: number;
  venueCoverage: number;
}

export interface BulkRebuildPreviewResult {
  phase: string;
  productionMutationsInThisRun: 0;
  rolloutActivated: false;
  horizon: { start: string; end: string };
  metrics: BulkRebuildMetrics;
  sourceCoverage: Array<Record<string, unknown>>;
  events: BulkRebuildEventRow[];
  acceptance: Record<string, unknown>;
  detailFetchMetrics?: import('./detail-evidence-types').DetailFetchMetrics;
  cutoverPlan: Record<string, unknown>;
  rollbackPlan: Record<string, unknown>;
  cutoverManifest?: Record<string, unknown>;
  cutoverRollback?: Record<string, unknown>;
}
