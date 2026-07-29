export function organizerProfileRoute(id: string): string {
  return `/organizer/${encodeURIComponent(id)}`;
}

export function venueProfileRoute(id: string): string {
  return `/venue/${encodeURIComponent(id)}`;
}

export function artistProfileRoute(id: string): string {
  return `/artist/${encodeURIComponent(id)}`;
}
