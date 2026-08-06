export const matchingConfig = {
  duplicateThreshold: 70,
  scores: {
    externalId: 100,
    titleDateVenue: 95,
    titleDateCoordinates: 90,
    titleDateArtist: 80,
  },
  cityCoordinateRadiusKm: 25,
  venueCoordinateRadiusKm: 0.5,
  minVenueConfidence: 60,
  minCityConfidence: 70,
  minArtistConfidence: 75,
  minGenreConfidence: 70,
  minOrganizerConfidence: 80,
} as const;

export const CITY_ALIASES: Record<string, string[]> = {
  koeln: ['köln', 'cologne', 'koeln'],
  muenchen: ['münchen', 'munich', 'muenchen', 'munchen'],
  berlin: ['berlin'],
  hamburg: ['hamburg'],
};

export const GENRE_SYNONYMS: Record<string, string[]> = {
  techno: ['techno'],
  'hard-techno': ['hard techno', 'hard-techno', 'hardtechno'],
  house: ['house'],
  trance: ['trance'],
  psy: ['psy', 'psytrance', 'psy-trance'],
  industrial: ['industrial'],
  'drum-and-bass': ['drum and bass', 'drum & bass', 'dnb', 'drum-and-bass'],
  'tech-house': ['tech house', 'tech-house', 'techhouse'],
  'melodic-techno': ['melodic techno', 'melodic-techno'],
  'deep-house': ['deep house', 'deep-house'],
  hardstyle: ['hardstyle', 'hard style'],
};

export const ARTIST_ALIASES: Record<string, string[]> = {
  // extendable known aliases
};
