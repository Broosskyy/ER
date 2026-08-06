/**
 * Phase 4.6.5 — Blocked detail origins must never degrade canonical fields.
 */

import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';

export type DetailFetchBlockReason =
  | 'pow_blocked'
  | 'max_detail_pages_zero'
  | 'wrong_platform'
  | 'fixture_mode'
  | 'fetch_error';

/** Fields that typically require detail HTML when list JSON-LD is sparse. */
export const DETAIL_DEPENDENT_FIELDS = new Set([
  'description',
  'lineup',
  'genreLabels',
  'ticketPhases',
  'badges',
  'doorsOpenAt',
  'ageRestriction',
]);

export function readDetailEnrichment(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata?.detailEnrichment || typeof metadata.detailEnrichment !== 'object') {
    return undefined;
  }
  return metadata.detailEnrichment as Record<string, unknown>;
}

export function resolveDetailFetchBlockReason(
  metadata: Record<string, unknown> | undefined,
): DetailFetchBlockReason | undefined {
  const detail = readDetailEnrichment(metadata);
  if (!detail) {
    return undefined;
  }
  if (detail.blockedByPow === true || detail.skippedReason === 'pow_blocked') {
    return 'pow_blocked';
  }
  const skipped = detail.skippedReason;
  if (
    skipped === 'max_detail_pages_zero' ||
    skipped === 'wrong_platform' ||
    skipped === 'fixture_mode'
  ) {
    return skipped;
  }
  if (Number(detail.detailUrlsAttempted ?? 0) > 0 && Number(detail.detailUrlsFetched ?? 0) === 0) {
    return 'pow_blocked';
  }
  return undefined;
}

export function isDetailFetchBlocked(metadata: Record<string, unknown> | undefined): boolean {
  return Boolean(resolveDetailFetchBlockReason(metadata));
}

export function isDetailDependentField(field: string): boolean {
  return DETAIL_DEPENDENT_FIELDS.has(field);
}

/**
 * When detail fetch is blocked, a lower-quality origin must not clear or replace
 * stronger canonical data for detail-dependent fields.
 */
export function shouldRejectBlockedOriginOverwrite(input: {
  field: string;
  existingValue: unknown;
  incomingValue: unknown;
  metadata?: Record<string, unknown>;
  isEnrichment: boolean;
}): { reject: boolean; reason?: string } {
  const blockReason = resolveDetailFetchBlockReason(input.metadata);
  if (!blockReason) {
    return { reject: false };
  }

  if (!isDetailDependentField(input.field)) {
    return { reject: false };
  }

  const hasExisting = hasMeaningfulEventValue(input.existingValue);
  const hasIncoming = hasMeaningfulEventValue(input.incomingValue);

  if (hasExisting && !hasIncoming) {
    return {
      reject: true,
      reason: `blocked_origin_${blockReason}_would_clear_${input.field}`,
    };
  }

  if (
    input.isEnrichment &&
    hasExisting &&
    hasIncoming &&
    input.field === 'description' &&
    String(input.incomingValue).trim().length < String(input.existingValue).trim().length
  ) {
    return {
      reject: true,
      reason: `blocked_origin_${blockReason}_shorter_description`,
    };
  }

  return { reject: false };
}
