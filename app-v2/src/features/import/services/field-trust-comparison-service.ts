import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import { importUpdateService } from '@/features/aggregation/services/import-update-service';
import {
  isEnrichmentPublish,
  resolveSourcePublishBehavior,
} from '@/features/import/domain/publish-behavior';
import { fieldTrustMergeService } from '@/features/import/services/field-trust-merge-service';

const COMPARED_FIELDS = [
  'title',
  'subtitle',
  'description',
  'startDate',
  'endDate',
  'venueName',
  'venueCity',
  'organizerName',
  'ticketUrl',
  'priceText',
  'imageUrl',
  'websiteUrl',
  'sourceId',
] as const;

export type FieldTrustComparisonCategory =
  | 'identical'
  | 'intentional_improvement'
  | 'unexpected'
  | 'blocked_manual_lock'
  | 'potentially_destructive';

export interface FieldTrustFieldDiff {
  field: (typeof COMPARED_FIELDS)[number];
  category: FieldTrustComparisonCategory;
  legacyValue?: unknown;
  trustValue?: unknown;
  reason?: string;
}

export interface FieldTrustEventComparison {
  eventId: string;
  eventTitle: string;
  sourceId: string;
  isEnrichment: boolean;
  identical: boolean;
  diffs: FieldTrustFieldDiff[];
  manualLocks: string[];
}

function normalizeComparableInstant(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString();
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (
    (typeof left === 'string' && typeof right === 'string') &&
    (left.includes('T') || right.includes('T'))
  ) {
    const leftInstant = normalizeComparableInstant(left);
    const rightInstant = normalizeComparableInstant(right);
    if (leftInstant && rightInstant && leftInstant === rightInstant) {
      return true;
    }
  }

  const leftText = typeof left === 'string' ? left.trim() : left;
  const rightText = typeof right === 'string' ? right.trim() : right;
  return leftText === rightText;
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function classifyDiff(
  field: (typeof COMPARED_FIELDS)[number],
  legacyValue: unknown,
  trustValue: unknown,
  options: {
    manualLocks: Set<string>;
    isEnrichment: boolean;
  },
): FieldTrustFieldDiff | null {
  if (valuesEqual(legacyValue, trustValue)) {
    return null;
  }

  if (options.manualLocks.has(field) || options.manualLocks.has(field === 'priceText' ? 'ticketUrl' : field)) {
    return {
      field,
      category: 'blocked_manual_lock',
      legacyValue,
      trustValue,
      reason: 'manual_override provenance lock',
    };
  }

  if (isEmptyValue(trustValue) && !isEmptyValue(legacyValue)) {
    return {
      field,
      category: 'potentially_destructive',
      legacyValue,
      trustValue,
      reason: 'trust path would clear meaningful value',
    };
  }

  if (field === 'ticketUrl' && !isEmptyValue(trustValue) && isEmptyValue(legacyValue)) {
    return {
      field,
      category: 'intentional_improvement',
      legacyValue,
      trustValue,
      reason: 'trust path fills ticket URL',
    };
  }

  if (
    field === 'description' &&
    options.isEnrichment &&
    !isEmptyValue(trustValue) &&
    (isEmptyValue(legacyValue) || String(legacyValue).length < String(trustValue).length)
  ) {
    return {
      field,
      category: 'intentional_improvement',
      legacyValue,
      trustValue,
      reason: 'enrichment fill-only description',
    };
  }

  if (
    field === 'priceText' &&
    options.isEnrichment &&
    !isEmptyValue(trustValue) &&
    isEmptyValue(legacyValue)
  ) {
    return {
      field,
      category: 'intentional_improvement',
      legacyValue,
      trustValue,
      reason: 'enrichment fill-only price',
    };
  }

  return {
    field,
    category: 'unexpected',
    legacyValue,
    trustValue,
    reason: 'legacy vs trust divergence',
  };
}

export function compareLegacyAndFieldTrustAdminEvent(input: {
  existing: AdminEventRecord;
  candidate: CanonicalImportEvent;
  source: SourceRecord;
  provenanceByField?: Map<string, FieldProvenance>;
}): FieldTrustEventComparison {
  const behavior = resolveSourcePublishBehavior(input.source);
  const isEnrichment = isEnrichmentPublish(input.source, true);

  const legacyEvent = isEnrichment
    ? importUpdateService.buildEnrichmentAdminEvent(input.existing, input.candidate)
    : importUpdateService.buildUpdatedAdminEvent(input.existing, input.candidate, input.source.id);

  const trustResult = fieldTrustMergeService.mergeAdminEvent({
    existing: input.existing,
    candidate: input.candidate,
    source: input.source,
    behavior,
    provenanceByField: input.provenanceByField,
  });

  const manualLocks = new Set<string>();
  for (const [field, provenance] of input.provenanceByField ?? []) {
    if (provenance.selectedSourceId === 'manual_override') {
      manualLocks.add(field);
    }
  }

  const diffs: FieldTrustFieldDiff[] = [];
  for (const field of COMPARED_FIELDS) {
    const diff = classifyDiff(field, legacyEvent[field], trustResult.event[field], {
      manualLocks,
      isEnrichment,
    });
    if (diff) {
      diffs.push(diff);
    }
  }

  return {
    eventId: input.existing.id,
    eventTitle: input.existing.title,
    sourceId: input.source.id,
    isEnrichment,
    identical: diffs.length === 0,
    diffs,
    manualLocks: [...manualLocks],
  };
}

export function summarizeFieldTrustComparisons(
  comparisons: FieldTrustEventComparison[],
): {
  total: number;
  identical: number;
  intentionalImprovements: number;
  unexpected: number;
  blockedManualLocks: number;
  potentiallyDestructive: number;
  safeToEnable: boolean;
} {
  let intentionalImprovements = 0;
  let unexpected = 0;
  let blockedManualLocks = 0;
  let potentiallyDestructive = 0;

  for (const comparison of comparisons) {
    for (const diff of comparison.diffs) {
      switch (diff.category) {
        case 'intentional_improvement':
          intentionalImprovements += 1;
          break;
        case 'unexpected':
          unexpected += 1;
          break;
        case 'blocked_manual_lock':
          blockedManualLocks += 1;
          break;
        case 'potentially_destructive':
          potentiallyDestructive += 1;
          break;
        default:
          break;
      }
    }
  }

  const identical = comparisons.filter((entry) => entry.identical).length;

  return {
    total: comparisons.length,
    identical,
    intentionalImprovements,
    unexpected,
    blockedManualLocks,
    potentiallyDestructive,
    safeToEnable: potentiallyDestructive === 0 && unexpected === 0,
  };
}
