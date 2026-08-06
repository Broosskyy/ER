/**
 * Complete gold-standard field matrix for Phase 4.8.1.1 acceptance.
 */
export const COMPLETE_FIELD_MATRIX_FIELDS = [
  'identity',
  'title',
  'subtitle',
  'date',
  'start',
  'end',
  'doors',
  'venue',
  'city',
  'address',
  'coordinates',
  'organizer',
  'promoter',
  'genres',
  'description',
  'flyer',
  'gallery',
  'lineup',
  'artists',
  'ticket_platform',
  'official_event_url',
  'consumer_cta',
  'checkout_url',
  'price',
  'minimum_price',
  'maximum_price',
  'ticket_phases',
  'availability',
  'sold_out',
  'attributes',
] as const;

export type CompleteMatrixField = (typeof COMPLETE_FIELD_MATRIX_FIELDS)[number];

export type MatrixCellStatus =
  | 'ground_truth_verified'
  | 'legacy_correct'
  | 'unified_correct'
  | 'unified_unsupported'
  | 'not_public'
  | 'externally_blocked'
  | 'review_required'
  | 'not_supported';

export type BlockerClass =
  | 'PUBLIC_SOURCE_HAS_NO_FIELD'
  | 'PUBLIC_DETAIL_EXTERNALLY_BLOCKED'
  | 'EVENT_NOT_PRESENT_ON_ACCESSIBLE_LIST'
  | 'IDENTITY_MATCH_INSUFFICIENT'
  | 'IMPORTER_DOES_NOT_SUPPORT_FIELD'
  | 'EVIDENCE_EXTRACTOR_FAILED'
  | 'REVIEW_REQUIRED'
  | 'THIRD_PARTY_BROWSER_ONLY'
  | 'GROUND_TRUTH_NOT_VERIFIED'
  | 'LIST_EVIDENCE_AVAILABLE_DETAIL_BLOCKED';

import { decodeHtmlEntities as decodeHtmlEntitiesFromNormalizer } from '@/features/import/normalization/text-normalizer';

export function decodeHtmlEntities(value: string): string {
  return decodeHtmlEntitiesFromNormalizer(value).replace(/\s+/g, ' ').trim();
}

export function normalizeForCompare(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => normalizeForCompare(v)).filter(Boolean).join('|');
  if (typeof value === 'object') return JSON.stringify(value);
  return decodeHtmlEntities(String(value)).toLowerCase();
}

export function valuesAlignForCompare(a: unknown, b: unknown): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}
