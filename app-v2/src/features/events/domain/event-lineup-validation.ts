import { AppError } from '@/core/errors/app-error';
import type { ArtistRecord } from '@/data/types/records';
import { isArtistBillingRole } from '@/features/events/domain/artist-billing-role';
import type { EventLineupInput } from '@/features/events/domain/event-lineup';

export function validateEventLineupInputs(
  lineup: EventLineupInput[],
  artistsById: Map<string, ArtistRecord>,
): EventLineupInput[] {
  const seen = new Set<string>();
  const normalized: EventLineupInput[] = [];

  for (const entry of lineup) {
    const artistId = entry.artistId?.trim();
    if (!artistId) {
      throw new AppError('Lineup entries require a valid artist.', { code: 'VALIDATION' });
    }

    if (!isArtistBillingRole(entry.billingRole)) {
      throw new AppError(`Invalid billing role: ${entry.billingRole}`, { code: 'VALIDATION' });
    }

    if (seen.has(artistId)) {
      throw new AppError('Each artist can only appear once in a lineup.', { code: 'VALIDATION' });
    }

    const artist = artistsById.get(artistId);
    if (!artist) {
      throw new AppError(`Artist not found: ${artistId}`, { code: 'VALIDATION' });
    }

    if (artist.status === 'archived') {
      throw new AppError(`Archived artists cannot be assigned: ${artist.name}`, {
        code: 'VALIDATION',
      });
    }

    seen.add(artistId);
    normalized.push({ artistId, billingRole: entry.billingRole });
  }

  return normalized;
}
