import type { RawWebsiteEvent } from '@/features/aggregation/connectors/website/types';
import type { UnifiedImportResult } from '@/features/import/contracts';
import { valuesSemanticallyEqual } from '@/features/import/shadow/official-website-public-truth';
import { extractUnifiedField } from '@/features/import/shadow/shadow-field-comparison';

export type IntegratedFieldStatus =
  | 'BOTH_CORRECT'
  | 'UNIFIED_BETTER'
  | 'LEGACY_BETTER'
  | 'BOTH_INCORRECT'
  | 'PUBLIC_SOURCE_HAS_NO_FIELD'
  | 'UNIFIED_UNSUPPORTED'
  | 'LEGACY_UNSUPPORTED'
  | 'REVIEW_REQUIRED'
  | 'FORMATTING_ONLY';

export const INTEGRATED_COMPARISON_FIELDS = [
  'title',
  'description',
  'dateTime',
  'venue',
  'organizer',
  'promoter',
  'genres',
  'flyer',
  'gallery',
  'lineupState',
  'lineupEntries',
  'ticketUrl',
  'rejectedLinks',
  'diagnostics',
] as const;

export type IntegratedComparisonField = (typeof INTEGRATED_COMPARISON_FIELDS)[number];

export type IntegratedFieldComparison = {
  field: IntegratedComparisonField;
  status: IntegratedFieldStatus;
  publicTruth?: unknown;
  legacy?: unknown;
  unified?: unknown;
  canonical?: unknown;
  rootCause?: string;
  rawEvidence?: string;
};

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function normalizeFormatting(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(normalizeFormatting).join('|');
  return String(value)
    .replace(/&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isFormattingOnly(a: unknown, b: unknown): boolean {
  if (isEmpty(a) || isEmpty(b)) return false;
  return normalizeFormatting(a) === normalizeFormatting(b);
}

export function extractLegacyIntegratedField(
  event: RawWebsiteEvent | undefined,
  field: IntegratedComparisonField,
): unknown {
  if (!event) return undefined;
  switch (field) {
    case 'title':
      return event.title;
    case 'description':
      return event.rawDescription;
    case 'dateTime':
      return event.rawStartDate;
    case 'venue':
      return event.rawVenue;
    case 'organizer':
      return event.rawOrganizer;
    case 'promoter':
      return undefined;
    case 'genres':
      return event.rawGenres;
    case 'flyer':
      return event.rawImages?.[0];
    case 'gallery':
      return event.rawImages;
    case 'lineupState':
      return event.rawArtists?.length ? 'explicit_artists' : 'empty';
    case 'lineupEntries':
      return event.rawArtists;
    case 'ticketUrl':
      return event.rawTicketLinks?.[0];
    case 'rejectedLinks':
      return undefined;
    case 'diagnostics':
      return event.warnings;
    default:
      return undefined;
  }
}

export function extractUnifiedIntegratedField(
  result: UnifiedImportResult | undefined,
  eventId: string,
  field: IntegratedComparisonField,
): unknown {
  if (!result) return undefined;
  switch (field) {
    case 'lineupState':
      return result.lineupEvidenceEntries?.length
        ? 'explicit_artists'
        : result.extractionDiagnostics.some((d) => d.code === 'LINEUP_TBA')
          ? 'tba'
          : 'empty';
    case 'lineupEntries':
      return result.lineupEvidenceEntries?.map((e) => e.displayName) ?? [];
    case 'rejectedLinks':
      return result.extractionDiagnostics
        .filter((d) => d.code.includes('REJECT') || d.code.includes('TICKET'))
        .map((d) => d.message);
    case 'diagnostics':
      return result.extractionDiagnostics;
    default: {
      const aliasMap: Record<string, string> = {
        dateTime: 'date_time',
        ticketUrl: 'ticket_destination_candidate',
        flyer: 'flyer',
        gallery: 'gallery',
      };
      return extractUnifiedField(result, eventId, aliasMap[field] ?? field);
    }
  }
}

export function classifyIntegratedFieldComparison(input: {
  field: IntegratedComparisonField;
  publicTruth?: unknown;
  legacy?: unknown;
  unified?: unknown;
  canonical?: unknown;
}): IntegratedFieldComparison {
  const { field, publicTruth, legacy, unified, canonical } = input;
  const hasPublic = !isEmpty(publicTruth);
  const hasLegacy = !isEmpty(legacy);
  const hasUnified = !isEmpty(unified);

  if (!hasPublic && !hasLegacy && !hasUnified) {
    return { field, status: 'PUBLIC_SOURCE_HAS_NO_FIELD' };
  }

  if (!hasUnified && hasLegacy) {
    return {
      field,
      status: hasPublic ? 'LEGACY_BETTER' : 'LEGACY_UNSUPPORTED',
      publicTruth,
      legacy,
      unified,
      canonical,
    };
  }

  if (hasUnified && !hasLegacy && hasPublic) {
    const unifiedMatches = valuesSemanticallyEqual(unified, publicTruth);
    const legacyMatches = hasLegacy && valuesSemanticallyEqual(legacy, publicTruth);
    if (unifiedMatches && !legacyMatches) {
      return { field, status: 'UNIFIED_BETTER', publicTruth, legacy, unified, canonical };
    }
  }

  if (hasUnified && hasPublic) {
    const unifiedMatches = valuesSemanticallyEqual(unified, publicTruth);
    const legacyMatches = hasLegacy && valuesSemanticallyEqual(legacy, publicTruth);
    if (unifiedMatches && legacyMatches) {
      return { field, status: 'BOTH_CORRECT', publicTruth, legacy, unified, canonical };
    }
    if (unifiedMatches && !legacyMatches) {
      return { field, status: 'UNIFIED_BETTER', publicTruth, legacy, unified, canonical };
    }
    if (!unifiedMatches && legacyMatches) {
      return {
        field,
        status: 'LEGACY_BETTER',
        publicTruth,
        legacy,
        unified,
        canonical,
        rootCause: 'Legacy matches public truth; unified does not',
        rawEvidence: String(publicTruth),
      };
    }
    if (!unifiedMatches && !legacyMatches) {
      return {
        field,
        status: 'BOTH_INCORRECT',
        publicTruth,
        legacy,
        unified,
        canonical,
        rootCause: 'Neither path matches public truth',
        rawEvidence: String(publicTruth),
      };
    }
  }

  if (hasUnified && hasLegacy && isFormattingOnly(unified, legacy)) {
    return { field, status: 'FORMATTING_ONLY', publicTruth, legacy, unified, canonical };
  }

  if (hasUnified && hasLegacy && valuesSemanticallyEqual(unified, legacy)) {
    return { field, status: 'BOTH_CORRECT', publicTruth, legacy, unified, canonical };
  }

  if (field === 'venue' && hasUnified && !hasPublic) {
    return {
      field,
      status: 'REVIEW_REQUIRED',
      publicTruth,
      legacy,
      unified,
      canonical,
      rootCause: 'Venue candidate without explicit public page field',
    };
  }

  if (!hasUnified) {
    return { field, status: 'UNIFIED_UNSUPPORTED', publicTruth, legacy, unified, canonical };
  }

  return {
    field,
    status: 'REVIEW_REQUIRED',
    publicTruth,
    legacy,
    unified,
    canonical,
  };
}

export function summarizeIntegratedFieldComparisons(
  comparisons: IntegratedFieldComparison[],
): Record<IntegratedFieldStatus, number> {
  const totals: Record<IntegratedFieldStatus, number> = {
    BOTH_CORRECT: 0,
    UNIFIED_BETTER: 0,
    LEGACY_BETTER: 0,
    BOTH_INCORRECT: 0,
    PUBLIC_SOURCE_HAS_NO_FIELD: 0,
    UNIFIED_UNSUPPORTED: 0,
    LEGACY_UNSUPPORTED: 0,
    REVIEW_REQUIRED: 0,
    FORMATTING_ONLY: 0,
  };
  for (const comparison of comparisons) {
    totals[comparison.status] += 1;
  }
  return totals;
}

export function findUnexplainedClaimedFieldGaps(
  comparisons: IntegratedFieldComparison[],
): IntegratedFieldComparison[] {
  return comparisons.filter(
    (c) =>
      (c.status === 'LEGACY_BETTER' || c.status === 'BOTH_INCORRECT') &&
      !c.rootCause &&
      c.field !== 'promoter',
  );
}
