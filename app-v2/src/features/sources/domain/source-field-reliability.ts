import type { FieldCoverageRating } from '@/features/aggregation/connectors/framework/detail-extraction';
import type { SourceCapabilityField } from '@/features/sources/domain/source-capability-fields';

export type FieldReliabilityStatus =
  | 'supported'
  | 'unsupported'
  | 'blocked'
  | 'partial'
  | 'derived';

export interface SourceFieldReliability {
  field: SourceCapabilityField;
  status: FieldReliabilityStatus;
  /** Expected trust 1–5 (configuration, not measured). */
  confidence: FieldCoverageRating;
  sourceLayer: 'list' | 'detail' | 'structured' | 'api' | 'none';
  notes?: string;
}

export function ratingToReliabilityStatus(
  rating: FieldCoverageRating,
  sourceLayer: SourceFieldReliability['sourceLayer'],
  detailBlocked?: boolean,
): FieldReliabilityStatus {
  if (detailBlocked && sourceLayer === 'detail') {
    return 'blocked';
  }
  if (rating <= 1) {
    return 'unsupported';
  }
  if (rating === 2) {
    return 'partial';
  }
  if (sourceLayer === 'none' && rating >= 3) {
    return 'derived';
  }
  return 'supported';
}

export function isFieldExpectedFromSource(entry: SourceFieldReliability): boolean {
  return entry.status === 'supported' || entry.status === 'partial' || entry.status === 'derived';
}

export function isFieldRegressionCandidate(entry: SourceFieldReliability): boolean {
  return entry.status === 'supported' && entry.confidence >= 4;
}
