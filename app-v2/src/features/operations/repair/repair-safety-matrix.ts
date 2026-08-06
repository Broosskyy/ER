import type { FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import { FIELD_OWNERSHIP_RULES } from '@/features/events/domain/field-ownership-policy';

import type { RepairProvenanceSnapshot, RepairSafety } from './repair-plan.types';

export interface RepairFieldSafetyRule {
  field: string;
  ownershipField: string;
  provenanceRequired: boolean;
  manualLockBlocksRepair: boolean;
  allowWithoutProvenanceWhenEmpty: boolean;
  description: string;
}

const CANONICAL_REPAIR_FIELDS = [
  'title',
  'description',
  'startDate',
  'endDate',
  'venueName',
  'venueId',
  'venueCity',
  'cityName',
  'countryCode',
  'organizerName',
  'organizerId',
  'lineup',
  'artistNames',
  'ticketUrl',
  'priceText',
  'priceAmount',
  'priceCurrency',
  'ticketStatus',
  'imageUrl',
  'websiteUrl',
  'timezone',
  'latitude',
  'longitude',
  'genres',
  'status',
  'cache',
] as const;

function ownershipDescription(field: string): string {
  return FIELD_OWNERSHIP_RULES.find((rule) => rule.field === field)?.description ?? 'Canonical field repair policy.';
}

export const REPAIR_CANONICAL_FIELD_SAFETY_MATRIX: RepairFieldSafetyRule[] = CANONICAL_REPAIR_FIELDS.map(
  (field) => ({
    field,
    ownershipField:
      field === 'venueCity' || field === 'cityName'
        ? 'venueName'
        : field === 'artistNames'
          ? 'lineup'
          : field === 'priceText'
            ? 'priceAmount'
            : field,
    provenanceRequired: !['cache', 'status', 'genres', 'timezone', 'latitude', 'longitude'].includes(field),
    manualLockBlocksRepair: true,
    allowWithoutProvenanceWhenEmpty: ['description', 'priceText', 'imageUrl', 'lineup', 'artistNames'].includes(
      field,
    ),
    description: ownershipDescription(
      field === 'venueCity' || field === 'cityName'
        ? 'venueName'
        : field === 'artistNames'
          ? 'lineup'
          : field === 'priceText'
            ? 'priceAmount'
            : field,
    ),
  }),
);

export function getRepairFieldSafetyRule(field: string): RepairFieldSafetyRule | undefined {
  return REPAIR_CANONICAL_FIELD_SAFETY_MATRIX.find((rule) => rule.field === field);
}

export function isProvenanceAuthorityComplete(
  provenance: RepairProvenanceSnapshot | FieldProvenance | undefined,
  rule: RepairFieldSafetyRule,
): boolean {
  if (!rule.provenanceRequired) {
    return true;
  }
  if (!provenance) {
    return rule.allowWithoutProvenanceWhenEmpty;
  }
  if ('manuallyOverridden' in provenance) {
    return Boolean(provenance.selectedSourceId) && Boolean(provenance.selectionReason);
  }
  return Boolean(provenance.selectedSourceId) && Boolean(provenance.selectionReason);
}

export function isManualLockActive(
  provenance: RepairProvenanceSnapshot | FieldProvenance | undefined,
): boolean {
  if (!provenance) {
    return false;
  }
  if ('manuallyOverridden' in provenance) {
    return provenance.manuallyOverridden || provenance.selectedSourceId === 'manual_override';
  }
  return provenance.selectedSourceId === 'manual_override';
}

export function classifyRepairFieldSafety(input: {
  field: string;
  provenance?: RepairProvenanceSnapshot | FieldProvenance;
  requiresReview?: boolean;
  supported?: boolean;
}): RepairSafety {
  const rule = getRepairFieldSafetyRule(input.field);
  if (input.supported === false) {
    return 'unsupported';
  }
  if (!rule) {
    return input.requiresReview ? 'review_required' : 'safe_read_only_plan';
  }
  if (isManualLockActive(input.provenance)) {
    return 'blocked_manual_lock';
  }
  if (!isProvenanceAuthorityComplete(input.provenance, rule)) {
    return 'blocked_missing_provenance';
  }
  if (input.requiresReview) {
    return 'review_required';
  }
  return 'safe_read_only_plan';
}

export function summarizeRepairSafety(changes: Array<{ safety: RepairSafety }>): {
  proposedCount: number;
  blockedCount: number;
  reviewRequiredCount: number;
} {
  let proposedCount = 0;
  let blockedCount = 0;
  let reviewRequiredCount = 0;

  for (const change of changes) {
    if (change.safety === 'safe_read_only_plan') {
      proposedCount += 1;
    } else if (change.safety === 'review_required') {
      reviewRequiredCount += 1;
    } else {
      blockedCount += 1;
    }
  }

  return { proposedCount, blockedCount, reviewRequiredCount };
}
