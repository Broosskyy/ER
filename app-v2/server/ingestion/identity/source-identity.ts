import type { EventCandidateVenue } from '../types/event-candidate';

export function buildVenueIdentityKey(venue: EventCandidateVenue): string {
  return [venue.name, venue.city ?? '', venue.postalCode ?? ''].map((part) => part.trim().toLowerCase()).join('|');
}

export function canonicalizeOfficialSourceUrl(url: string): string {
  const parsed = new URL(url);
  const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return `https://${parsed.host}${pathname}`;
}
