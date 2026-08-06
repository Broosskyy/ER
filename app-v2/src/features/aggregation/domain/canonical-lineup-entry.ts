import type { LineupEntrySource } from '@/features/aggregation/domain/structured-lineup';

/** Canonical billing relation preserved through the full pipeline. */
export type BillingRelation =
  | 'SOLO'
  | 'B2B'
  | 'F2F'
  | 'VS'
  | 'LIVE'
  | 'SUPPORT'
  | 'HOSTED_BY'
  | 'SPECIAL_GUEST';

export interface LineupEntryProvenance {
  source?: LineupEntrySource | string;
  sourceUrl?: string;
  connector?: string;
  extractedAt?: string;
  importRecordId?: string;
}

/** Import-stage lineup entry — artists are display names before entity resolution. */
export interface CanonicalLineupEntry {
  order: number;
  artists: string[];
  billingRelation: BillingRelation;
  stage?: string;
  startTime?: string;
  endTime?: string;
  runningOrder?: number;
  confidence?: number;
  provenance?: LineupEntryProvenance;
}

/** Canonical-stage lineup entry — artists resolved to entity IDs. */
export interface ResolvedCanonicalLineupEntry extends CanonicalLineupEntry {
  artistIds: string[];
  entryId?: string;
}

export const BILLING_RELATIONS: BillingRelation[] = [
  'SOLO',
  'B2B',
  'F2F',
  'VS',
  'LIVE',
  'SUPPORT',
  'HOSTED_BY',
  'SPECIAL_GUEST',
];

export function billingRelationLabel(relation: BillingRelation): string {
  switch (relation) {
    case 'B2B':
      return 'b2b';
    case 'F2F':
      return 'f2f';
    case 'VS':
      return 'vs';
    case 'LIVE':
      return 'live';
    case 'SUPPORT':
      return 'support';
    case 'HOSTED_BY':
      return 'hosted by';
    case 'SPECIAL_GUEST':
      return 'special guest';
    default:
      return '';
  }
}

/** Flatten structured entries to ordered unique artist display names (backward compat). */
export function flattenCanonicalLineupArtistNames(entries: CanonicalLineupEntry[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of [...entries].sort((left, right) => left.order - right.order)) {
    for (const name of entry.artists) {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(name.trim());
    }
  }
  return result;
}

/** Flatten resolved entries to artist IDs preserving entry order. */
export function flattenResolvedLineupArtistIds(entries: ResolvedCanonicalLineupEntry[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of [...entries].sort((left, right) => left.order - right.order)) {
    for (const artistId of entry.artistIds) {
      if (!artistId || seen.has(artistId)) {
        continue;
      }
      seen.add(artistId);
      result.push(artistId);
    }
  }
  return result;
}

export function formatLineupEntryDisplay(entry: Pick<CanonicalLineupEntry, 'artists' | 'billingRelation'>): string {
  const names = entry.artists.filter(Boolean);
  if (names.length === 0) {
    return '';
  }
  if (entry.billingRelation === 'SOLO' || names.length === 1) {
    return names[0] ?? '';
  }
  const separator = ` ${billingRelationLabel(entry.billingRelation)} `;
  return names.join(separator);
}
