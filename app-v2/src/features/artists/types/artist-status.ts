/** Canonical artist lifecycle statuses (DB, domain, services). */
export const ARTIST_LIFECYCLE_STATUSES = ['draft', 'published', 'archived'] as const;

export type ArtistLifecycleStatus = (typeof ARTIST_LIFECYCLE_STATUSES)[number];

export const ARTIST_VERIFICATION_STATUSES = ['unverified', 'verified'] as const;

export type ArtistVerificationStatus = (typeof ARTIST_VERIFICATION_STATUSES)[number];

export function isArtistLifecycleStatus(value: string): value is ArtistLifecycleStatus {
  return (ARTIST_LIFECYCLE_STATUSES as readonly string[]).includes(value);
}

export function isArtistVerificationStatus(value: string): value is ArtistVerificationStatus {
  return (ARTIST_VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export function isPublishedArtistStatus(status: ArtistLifecycleStatus): boolean {
  return status === 'published';
}
