import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import { compactLineupArtistIdentityKey } from '@/features/import/domain/golden-content-quality-gate';

const LEGACY_BACKFILL_SOURCE = 'event_artists_backfill';
const LOW_CONFIDENCE_THRESHOLD = 0.55;

/** Ordered billing labels as shown to consumers (one entry per structured row). */
export function lineupBillingNamesFromEntries(entries: ResolvedCanonicalLineupEntry[]): string[] {
  return [...entries]
    .sort((left, right) => left.order - right.order)
    .map((entry) =>
      entry.artists
        .map((name) => name.trim())
        .filter(Boolean)
        .join(' & '),
    )
    .filter(Boolean);
}

export function lineupBillingNamesFingerprint(names: string[]): string {
  return names
    .map((name) => compactLineupArtistIdentityKey(name))
    .filter(Boolean)
    .join('|');
}

export function isLegacyBackfillLineupEntry(entry: ResolvedCanonicalLineupEntry): boolean {
  return (
    entry.provenance?.source === LEGACY_BACKFILL_SOURCE ||
    (entry.confidence ?? 1) <= LOW_CONFIDENCE_THRESHOLD
  );
}

export function lineupEntryFingerprint(entry: ResolvedCanonicalLineupEntry): string {
  return [
    entry.billingRelation,
    entry.order,
    entry.artistIds.join('|'),
    entry.stage ?? '',
    entry.startTime ?? '',
    entry.endTime ?? '',
    entry.runningOrder ?? '',
  ].join(':');
}

export function compareResolvedLineupEntries(
  existing: ResolvedCanonicalLineupEntry[],
  incoming: ResolvedCanonicalLineupEntry[],
): boolean {
  if (existing.length !== incoming.length) {
    return false;
  }

  const sortedExisting = [...existing].sort((left, right) => left.order - right.order);
  const sortedIncoming = [...incoming].sort((left, right) => left.order - right.order);

  return sortedExisting.every(
    (entry, index) =>
      lineupEntryFingerprint(entry) === lineupEntryFingerprint(sortedIncoming[index]!),
  );
}

/** Whether import-derived structured entries should replace persisted entries. */
export function needsStructuredLineupReplace(
  existing: ResolvedCanonicalLineupEntry[],
  incoming: ResolvedCanonicalLineupEntry[],
): boolean {
  if (incoming.length === 0) {
    return false;
  }
  if (existing.length === 0) {
    return true;
  }

  const structureMatches = compareResolvedLineupEntries(existing, incoming);
  const allExistingLegacyBackfill = existing.every(isLegacyBackfillLineupEntry);
  const incomingFromImport = incoming.some((entry) => Boolean(entry.provenance?.importRecordId));
  const incomingHasRichBilling = incoming.some((entry) => entry.billingRelation !== 'SOLO');
  const billingNamesDiffer =
    lineupBillingNamesFingerprint(lineupBillingNamesFromEntries(existing)) !==
    lineupBillingNamesFingerprint(lineupBillingNamesFromEntries(incoming));

  if (allExistingLegacyBackfill && incomingFromImport) {
    return true;
  }

  if (allExistingLegacyBackfill && billingNamesDiffer) {
    return true;
  }

  if (!structureMatches && incomingHasRichBilling) {
    return true;
  }

  if (!structureMatches) {
    return true;
  }

  return false;
}
