import type { EventDisplayModel } from '@/features/events/formatting/display-event';

/**
 * Universal search result types.
 * Future social types are reserved in the contract but not fabricated in UI.
 */
export type UniversalSearchResultType =
  | 'EVENT'
  | 'ARTIST'
  | 'VENUE'
  | 'ORGANIZER'
  | 'FESTIVAL'
  | 'CITY'
  | 'GENRE'
  | 'USER'
  | 'COMMUNITY'
  | 'POST'
  | 'REEL';

/** Result types currently backed by real data and renderable in Search. */
export type RenderableUniversalSearchResultType =
  | 'EVENT'
  | 'ARTIST'
  | 'VENUE'
  | 'ORGANIZER'
  | 'CITY'
  | 'GENRE';

export interface UniversalSearchMatchedField {
  field: string;
  value: string;
}

export interface UniversalSearchResult {
  resultType: UniversalSearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  relevanceScore: number;
  matchedFields: UniversalSearchMatchedField[];
  relatedEventCount?: number;
  /** Validated navigable route; omit/empty means the row must stay inert. */
  route?: string;
}

export interface UniversalSearchGroupedResults {
  scope: import('./location-scope').LocationScope;
  appliedFilters: string[];
  query: string;
  totalEventMatches: number;
  events: EventDisplayModel[];
  artists: UniversalSearchResult[];
  venues: UniversalSearchResult[];
  organizers: UniversalSearchResult[];
  cities: UniversalSearchResult[];
  genres: UniversalSearchResult[];
  hasMoreEvents: boolean;
}

export interface UniversalSearchEntityReaders {
  listPublishedArtists(): Promise<
    Array<{ id: string; name: string; slug: string; imageUrl?: string; city?: string }>
  >;
  listVenues(): Promise<
    Array<{ id: string; name: string; slug: string; city: string; venueType?: string }>
  >;
  listOrganizers(): Promise<
    Array<{ id: string; name: string; slug: string; city?: string; logoUrl?: string }>
  >;
}
