export const ARTIST_BILLING_ROLES = [
  'headliner',
  'support',
  'special_guest',
  'other',
] as const;

export type ArtistBillingRole = (typeof ARTIST_BILLING_ROLES)[number];

export function isArtistBillingRole(value: string): value is ArtistBillingRole {
  return (ARTIST_BILLING_ROLES as readonly string[]).includes(value);
}
