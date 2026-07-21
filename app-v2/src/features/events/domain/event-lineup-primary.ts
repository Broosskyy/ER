import type { ArtistBillingRole } from '@/features/events/domain/artist-billing-role';
import type { EventLineupInput } from '@/features/events/domain/event-lineup';

export function derivePrimaryArtistId(
  lineup: Array<Pick<EventLineupInput, 'artistId' | 'billingRole'>>,
): string | null {
  if (lineup.length === 0) {
    return null;
  }

  const headliner = lineup.find((entry) => entry.billingRole === 'headliner');
  return headliner?.artistId ?? lineup[0]?.artistId ?? null;
}

export function normalizeLineupInputs(lineup: EventLineupInput[]): EventLineupInput[] {
  return lineup.map((entry) => ({
    artistId: entry.artistId.trim(),
    billingRole: entry.billingRole,
  }));
}

export function buildLineupFromMatchedArtistIds(artistIds: string[]): EventLineupInput[] {
  const unique: string[] = [];
  for (const artistId of artistIds) {
    const trimmed = artistId.trim();
    if (!trimmed || unique.includes(trimmed)) {
      continue;
    }
    unique.push(trimmed);
  }

  return unique.map((artistId, index) => ({
    artistId,
    billingRole: (index === 0 ? 'headliner' : 'support') as ArtistBillingRole,
  }));
}
