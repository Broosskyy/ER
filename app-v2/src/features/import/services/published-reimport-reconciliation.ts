import type { ImportChangeSet } from '@/features/aggregation/services/import-update-service';
import { importUpdateService } from '@/features/aggregation/services/import-update-service';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import type { EventLifecycleEvaluation } from '@/features/event-lifecycle/domain/lifecycle-engine-types';
import type { ImportRecord } from '@/features/import/models/types';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { recordCandidateEquivalent } from '@/features/import/services/import-record-identity';
import type { MultiSourceMatchEvaluation } from '@/features/multi-source-matching/domain/matching-types';
import type { TrustPublishEvaluation } from '@/features/trust-quality/domain/trust-quality-types';

const BENIGN_TRUST_REVIEW_REASON_FRAGMENTS = [
  'duplicate',
  'quality_score_below',
  'source_trust_below_publish',
] as const;

const CRITICAL_LIFECYCLE_FIELDS = new Set([
  'startDate',
  'endDate',
  'venueName',
  'venueId',
  'organizerName',
  'status',
  'title',
]);

export function recordHasLinkedPublishedEvent(record: ImportRecord): boolean {
  return Boolean(record.resultingEventId);
}

export function recordHasPublishedOutcome(
  record: ImportRecord,
  existingEvent?: AdminEventRecord | null,
): boolean {
  if (!record.resultingEventId) {
    return false;
  }

  if (existingEvent?.status === 'published') {
    return true;
  }

  return record.status === 'imported' || record.status === 'approved' || record.status === 'duplicate';
}

export function isBenignTrustReviewReason(reason: string): boolean {
  const normalized = reason.toLowerCase();
  return BENIGN_TRUST_REVIEW_REASON_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

export function hasBlockingTrustViolations(evaluation: TrustPublishEvaluation): boolean {
  return evaluation.violations.some((violation) => violation.severity === 'blocking');
}

export function isTrustDecisionDegradedForPublished(evaluation: TrustPublishEvaluation): boolean {
  if (evaluation.decision === 'hold' || evaluation.decision === 'reject') {
    return true;
  }

  if (evaluation.decision !== 'review_required') {
    return false;
  }

  return evaluation.reasons.some((reason) => !isBenignTrustReviewReason(reason));
}

export function detectSemanticChangeSet(
  record: ImportRecord,
  existingEvent?: AdminEventRecord | null,
): ImportChangeSet {
  const candidate = getEffectiveCandidate(record) as CanonicalImportEvent;
  return importUpdateService.detectChanges(candidate, existingEvent, {
    existingRecord: record,
    cancelled:
      (record.normalizedPayload as { isCancelled?: boolean; cancelled?: boolean } | undefined)
        ?.isCancelled === true ||
      (record.normalizedPayload as { isCancelled?: boolean; cancelled?: boolean } | undefined)
        ?.cancelled === true,
  });
}

export function isSemanticPayloadUnchanged(
  record: ImportRecord,
  existingEvent?: AdminEventRecord | null,
): boolean {
  const changeSet = detectSemanticChangeSet(record, existingEvent);
  if (changeSet.changeType === 'unchanged') {
    return true;
  }

  const candidate = getEffectiveCandidate(record) as CanonicalImportEvent;
  return recordCandidateEquivalent(record, candidate);
}

export function isStablePublishedTrustReimport(
  record: ImportRecord,
  evaluation: TrustPublishEvaluation,
  options: { existingEvent?: AdminEventRecord | null } = {},
): boolean {
  if (!recordHasLinkedPublishedEvent(record)) {
    return false;
  }

  if (!recordHasPublishedOutcome(record, options.existingEvent)) {
    return false;
  }

  if (!isSemanticPayloadUnchanged(record, options.existingEvent)) {
    return false;
  }

  if (hasBlockingTrustViolations(evaluation)) {
    return false;
  }

  if (evaluation.decision === 'reject') {
    return true;
  }

  if (isTrustDecisionDegradedForPublished(evaluation)) {
    return false;
  }

  if (evaluation.decision === 'auto_publish') {
    return true;
  }

  return evaluation.reasons.every(isBenignTrustReviewReason);
}

export function isStablePublishedMatchReimport(
  record: ImportRecord,
  evaluation: MultiSourceMatchEvaluation,
  options: { existingEvent?: AdminEventRecord | null } = {},
): boolean {
  if (!recordHasPublishedOutcome(record, options.existingEvent)) {
    return false;
  }

  if (evaluation.canonicalEventId !== record.resultingEventId) {
    return false;
  }

  if (evaluation.decision === 'keep_separate') {
    return false;
  }

  if (evaluation.fieldDifferences.some((difference) => difference.severity === 'critical')) {
    return false;
  }

  return isSemanticPayloadUnchanged(record, options.existingEvent);
}

export function isStablePublishedLifecycleReimport(
  record: ImportRecord,
  evaluation: EventLifecycleEvaluation,
  options: { existingEvent?: AdminEventRecord | null; changeSet?: ImportChangeSet } = {},
): boolean {
  if (!recordHasPublishedOutcome(record, options.existingEvent)) {
    return false;
  }

  if (evaluation.decision === 'create_conflict') {
    return false;
  }

  if (
    evaluation.changes.some(
      (change) =>
        change.severity === 'critical' || CRITICAL_LIFECYCLE_FIELDS.has(change.fieldPath),
    )
  ) {
    return false;
  }

  const changeSet = options.changeSet ?? detectSemanticChangeSet(record, options.existingEvent);
  return changeSet.changeType === 'unchanged';
}
