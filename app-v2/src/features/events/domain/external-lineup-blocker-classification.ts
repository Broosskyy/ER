import { isDetailFetchBlocked } from '@/features/events/domain/blocked-origin-guard';

export type ExternalLineupBlockerClass =
  | 'external_detail_blocked'
  | 'ready_for_flyer_candidate'
  | 'source_has_no_data';

export function classifyExternalLineupBlocker(input: {
  metadata?: Record<string, unknown>;
  hasRawLineup?: boolean;
  flyerEvidencePresent?: boolean;
}): ExternalLineupBlockerClass {
  const detailBlocked = isDetailFetchBlocked(input.metadata);
  if (detailBlocked && input.flyerEvidencePresent) {
    return 'ready_for_flyer_candidate';
  }
  if (detailBlocked) {
    return 'external_detail_blocked';
  }
  if (!input.hasRawLineup) {
    return 'source_has_no_data';
  }
  return 'source_has_no_data';
}

export function readExternalLineupBlockerClass(
  metadata: Record<string, unknown> | undefined,
): ExternalLineupBlockerClass | undefined {
  const detail = metadata?.detailEnrichment;
  if (!detail || typeof detail !== 'object') {
    return undefined;
  }
  const value = (detail as Record<string, unknown>).lineupBlockerClass;
  if (
    value === 'external_detail_blocked' ||
    value === 'ready_for_flyer_candidate' ||
    value === 'source_has_no_data'
  ) {
    return value;
  }
  return undefined;
}
