import { valuesSemanticallyEqual } from '@/features/import/shadow/official-website-public-truth';

export type ShadowFieldStatus =
  | 'UNIFIED_MATCHES_PUBLIC_TRUTH'
  | 'LEGACY_MATCHES_PUBLIC_TRUTH'
  | 'BOTH_MATCH_PUBLIC_TRUTH'
  | 'UNIFIED_BETTER'
  | 'LEGACY_BETTER'
  | 'BOTH_INCORRECT'
  | 'PUBLIC_SOURCE_HAS_NO_FIELD'
  | 'IMPORTER_UNSUPPORTED'
  | 'IDENTITY_REVIEW_REQUIRED'
  | 'SOURCE_CHANGED_DURING_SHADOW'
  | 'STALE_CANONICAL_PRODUCTION'
  | 'PROJECTION_DIFFERS_FROM_CANONICAL';

export interface ShadowFieldComparisonInput {
  field: string;
  publicTruth?: unknown;
  unified?: unknown;
  legacy?: unknown;
  canonical?: unknown;
  projection?: unknown;
  sourceChangedDuringShadow?: boolean;
}

export function classifyShadowFieldComparison(input: ShadowFieldComparisonInput): ShadowFieldStatus {
  const { field, publicTruth, unified, legacy, canonical, projection, sourceChangedDuringShadow } = input;

  if (sourceChangedDuringShadow) {
    return 'SOURCE_CHANGED_DURING_SHADOW';
  }

  const hasPublic = publicTruth !== undefined && publicTruth !== null && publicTruth !== '';
  const hasUnified = unified !== undefined && unified !== null && unified !== '';
  const hasLegacy = legacy !== undefined && legacy !== null && legacy !== '';
  const hasCanonical = canonical !== undefined && canonical !== null && canonical !== '';
  const hasProjection = projection !== undefined && projection !== null && projection !== '';

  if (!hasPublic && !hasUnified && hasLegacy && (field === 'organizer' || field === 'promoter')) {
    return 'PUBLIC_SOURCE_HAS_NO_FIELD';
  }

  if (!hasPublic && !hasUnified && !hasLegacy) {
    return 'PUBLIC_SOURCE_HAS_NO_FIELD';
  }

  const unifiedMatchesPublic = hasPublic && hasUnified && valuesSemanticallyEqual(unified, publicTruth);
  const legacyMatchesPublic = hasPublic && hasLegacy && valuesSemanticallyEqual(legacy, publicTruth);
  const bothMatchPublic = unifiedMatchesPublic && legacyMatchesPublic;

  if (bothMatchPublic) return 'BOTH_MATCH_PUBLIC_TRUTH';
  if (unifiedMatchesPublic && !legacyMatchesPublic && hasLegacy) return 'UNIFIED_BETTER';
  if (legacyMatchesPublic && !unifiedMatchesPublic && hasUnified) return 'LEGACY_BETTER';
  if (unifiedMatchesPublic) return 'UNIFIED_MATCHES_PUBLIC_TRUTH';
  if (legacyMatchesPublic) return 'LEGACY_MATCHES_PUBLIC_TRUTH';

  if (
    hasPublic &&
    hasUnified &&
    hasLegacy &&
    valuesSemanticallyEqual(unified, legacy) &&
    typeof publicTruth === 'string' &&
    typeof unified === 'string' &&
    publicTruth.toLowerCase().startsWith(unified.toLowerCase().slice(0, 24))
  ) {
    return 'BOTH_MATCH_PUBLIC_TRUTH';
  }

  if (hasUnified && hasPublic && valuesSemanticallyEqual(unified, publicTruth) && hasCanonical && !valuesSemanticallyEqual(canonical, publicTruth)) {
    return 'STALE_CANONICAL_PRODUCTION';
  }

  if (hasCanonical && hasProjection && !valuesSemanticallyEqual(canonical, projection)) {
    if (hasUnified && valuesSemanticallyEqual(unified, publicTruth)) {
      return 'PROJECTION_DIFFERS_FROM_CANONICAL';
    }
  }

  if (hasUnified && hasPublic && !valuesSemanticallyEqual(unified, publicTruth)) {
    if (hasCanonical && valuesSemanticallyEqual(legacy ?? canonical, publicTruth) && !valuesSemanticallyEqual(unified, publicTruth)) {
      return 'LEGACY_BETTER';
    }
    return 'BOTH_INCORRECT';
  }

  if (!hasUnified && hasLegacy && hasPublic) return 'LEGACY_BETTER';
  if (hasUnified && !hasLegacy && hasPublic && valuesSemanticallyEqual(unified, publicTruth)) return 'UNIFIED_BETTER';

  if (!hasPublic && hasUnified && !hasCanonical) return 'UNIFIED_BETTER';
  if (!hasPublic && !hasUnified && hasCanonical) return 'LEGACY_BETTER';

  if (field === 'identity') return 'IDENTITY_REVIEW_REQUIRED';

  return hasUnified || hasLegacy ? 'BOTH_INCORRECT' : 'PUBLIC_SOURCE_HAS_NO_FIELD';
}

export function extractUnifiedField(
  result: { fieldEvidenceCandidates: Array<{ fieldName: string; normalizedValue: unknown; eventIdentityMatch?: string }> },
  eventId: string,
  field: string,
): unknown {
  const aliases: Record<string, string[]> = {
    ticketUrl: ['ticket_destination_candidate', 'ticket_destination'],
    dateTime: ['date_time', 'startDate'],
    venue: ['venue', 'venueName'],
    location: ['location', 'venueAddress'],
    genres: ['genres', 'genre'],
    flyer: ['flyer', 'imageUrl'],
    gallery: ['gallery'],
  };
  const names = aliases[field] ?? [field];
  for (const name of names) {
    const hit = result.fieldEvidenceCandidates.find(
      (c) => c.eventIdentityMatch === eventId && c.fieldName === name,
    );
    if (hit) return hit.normalizedValue;
  }
  return undefined;
}
