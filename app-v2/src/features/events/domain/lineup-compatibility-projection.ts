import type { ArtistBillingRole } from '@/features/events/domain/artist-billing-role';
import type { EventLineupInput } from '@/features/events/domain/event-lineup';
import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';

function billingRoleForEntry(
  entry: ResolvedCanonicalLineupEntry,
): ArtistBillingRole {
  if (entry.billingRelation === 'SPECIAL_GUEST') {
    return 'special_guest';
  }
  return 'support';
}

/**
 * Derive flat `event_artists` rows from structured entries.
 * Structured entries are authoritative; this projection is compatibility-only.
 */
export function buildCompatibilityProjectionFromStructured(
  entries: ResolvedCanonicalLineupEntry[],
  options?: {
    artistsById?: Map<string, { lineupLegacyArtifact?: boolean }>;
  },
): EventLineupInput[] {
  const sorted = [...entries].sort((left, right) => left.order - right.order);
  const result: EventLineupInput[] = [];
  const seen = new Set<string>();

  for (const entry of sorted) {
    for (const artistId of entry.artistIds) {
      if (!artistId || seen.has(artistId)) {
        continue;
      }
      const artist = options?.artistsById?.get(artistId);
      if (artist?.lineupLegacyArtifact) {
        continue;
      }
      seen.add(artistId);
      result.push({
        artistId,
        billingRole: billingRoleForEntry(entry),
      });
    }
  }

  return result;
}

export function compatibilityProjectionMatches(
  projected: EventLineupInput[],
  existingArtistIds: string[],
): boolean {
  if (projected.length !== existingArtistIds.length) {
    return false;
  }
  return projected.every((entry, index) => entry.artistId === existingArtistIds[index]);
}
