export interface ArtistGenreMetadataLookup {
  artistName: string;
  identityKey: string;
  resolved: boolean;
  providerArtistId?: string;
  genreLabels: string[];
  normalizedGenres: Array<{ genreKey: string; displayName: string }>;
}
