export interface MatchResult {
  matchedCityId?: string;
  matchedVenueId?: string;
  matchedOrganizerId?: string;
  matchedArtistIds: string[];
  matchedGenreIds: string[];
  duplicateEventId?: string;
  duplicateScore: number;
  confidence: number;
  warnings: string[];
  details: {
    cityConfidence?: number;
    venueConfidence?: number;
    organizerConfidence?: number;
    artistConfidences: number[];
    genreConfidences: number[];
  };
}

export interface EntityMatchCandidate {
  id: string;
  name: string;
  slug?: string;
  aliases?: string[];
}

export interface KnownEventForDuplicateCheck {
  id: string;
  title: string;
  startDate: string;
  externalId?: string;
  venueId?: string;
  venueName?: string;
  cityId?: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
  artistNames?: string[];
  eventUrl?: string;
  ticketUrl?: string;
}

export interface MatchingCatalog {
  cities: EntityMatchCandidate[];
  venues: Array<{
    id: string;
    name: string;
    address?: string;
    cityId: string;
    cityName?: string;
    latitude?: number;
    longitude?: number;
  }>;
  organizers: Array<{
    id: string;
    name: string;
    city?: string;
    country?: string;
    website?: string;
    email?: string;
    instagram?: string;
    facebook?: string;
    soundcloud?: string;
    residentAdvisor?: string;
  }>;
  artists: Array<EntityMatchCandidate & { aliases?: string[] }>;
  genres: Array<EntityMatchCandidate & { aliases?: string[] }>;
  events: KnownEventForDuplicateCheck[];
}

export function createEmptyMatchResult(): MatchResult {
  return {
    matchedArtistIds: [],
    matchedGenreIds: [],
    duplicateScore: 0,
    confidence: 0,
    warnings: [],
    details: {
      artistConfidences: [],
      genreConfidences: [],
    },
  };
}