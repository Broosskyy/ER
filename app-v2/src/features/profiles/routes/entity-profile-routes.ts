export type EntityProfileRouteType = 'artist' | 'venue' | 'organizer';

export function organizerProfileRoute(id: string): string {
  return `/organizer/${encodeURIComponent(id)}`;
}

export function venueProfileRoute(id: string): string {
  return `/venue/${encodeURIComponent(id)}`;
}

export function artistProfileRoute(id: string): string {
  return `/artist/${encodeURIComponent(id)}`;
}

/**
 * Canonical public profile route resolver used by Search, Event Detail, and redirects.
 * Returns undefined when the type/id cannot form a valid singular Expo route.
 */
export function resolveEntityProfileRoute(
  type: EntityProfileRouteType | string,
  idOrSlug: string | undefined | null,
): string | undefined {
  const trimmed = idOrSlug?.trim();
  if (!trimmed) {
    return undefined;
  }

  switch (type) {
    case 'artist':
    case 'ARTIST':
      return artistProfileRoute(trimmed);
    case 'venue':
    case 'VENUE':
      return venueProfileRoute(trimmed);
    case 'organizer':
    case 'ORGANIZER':
      return organizerProfileRoute(trimmed);
    default:
      return undefined;
  }
}
