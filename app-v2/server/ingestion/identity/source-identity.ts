import type { EventCandidateVenue } from '../types/event-candidate';

export function buildVenueIdentityKey(venue: EventCandidateVenue): string {
  return [venue.name, venue.city ?? '', venue.postalCode ?? ''].map((part) => part.trim().toLowerCase()).join('|');
}

export function canonicalizeOfficialSourceUrl(url: string): string {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname;

  const eventId = parsed.searchParams.get('event');
  if (eventId && /^\d+$/.test(eventId) && /\/event-detail$/i.test(pathname)) {
    return `https://${hostname}${pathname}?event=${eventId}`;
  }

  const normalizedPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `https://${hostname}${normalizedPath}`;
}
