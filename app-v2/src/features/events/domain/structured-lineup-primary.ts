import type { EventLineupInput } from '@/features/events/domain/event-lineup';
import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import { buildCompatibilityProjectionFromStructured } from '@/features/events/domain/lineup-compatibility-projection';

/** Derive flat event_artists rows from structured entries for backward compatibility. */
export function buildLineupFromResolvedEntries(
  entries: ResolvedCanonicalLineupEntry[],
): EventLineupInput[] {
  return buildCompatibilityProjectionFromStructured(entries);
}
