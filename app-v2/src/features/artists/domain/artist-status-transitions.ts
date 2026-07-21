import type { ArtistLifecycleStatus } from '@/features/artists/types/artist-status';

/** CMS lifecycle transitions for admin editors. */
export const ARTIST_LIFECYCLE_TRANSITIONS: Readonly<
  Record<ArtistLifecycleStatus, readonly ArtistLifecycleStatus[]>
> = {
  draft: ['published', 'archived'],
  published: ['archived', 'draft'],
  archived: ['draft'],
};

export function canArtistLifecycleTransition(
  from: ArtistLifecycleStatus,
  to: ArtistLifecycleStatus,
): boolean {
  if (from === to) {
    return true;
  }

  return (ARTIST_LIFECYCLE_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function assertValidArtistLifecycleTransition(
  from: ArtistLifecycleStatus,
  to: ArtistLifecycleStatus,
): void {
  if (!canArtistLifecycleTransition(from, to)) {
    throw new Error(`Invalid artist status transition from ${from} to ${to}.`);
  }
}

export function requiresPrivilegedArtistLifecycleTransition(
  from: ArtistLifecycleStatus,
  to: ArtistLifecycleStatus,
): boolean {
  if (from === to) {
    return false;
  }

  return to === 'published' || to === 'archived' || from === 'archived';
}
