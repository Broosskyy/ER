import {
  runArtistGenreCorroborationPass,
  type ArtistGenreCorroborationReport,
} from './artist-genre-corroboration-pass';
import type { ArtistGenreMetadataLookup } from './artist-genre-metadata-pass.types';

export type ArtistGenreMetadataPassReport = Omit<ArtistGenreCorroborationReport, 'identityRecords'> & {
  lookups: ArtistGenreMetadataLookup[];
};

export async function runArtistGenreMetadataPass(input: {
  events: Array<{
    sourceEventKey: string;
    lineup: string[];
    genres: string[];
  }>;
  enabled?: boolean;
  useCache?: boolean;
}): Promise<ArtistGenreMetadataPassReport> {
  const report = await runArtistGenreCorroborationPass(input);
  return {
    ...report,
    lookups: report.identityRecords.map((record) => ({
      artistName: record.artistName,
      identityKey: record.identityKey,
      resolved: record.identityStatus === 'corroborated' && record.projectionDecision === 'published',
      providerArtistId: record.musicBrainzId,
      genreLabels: [...record.rawGenreLabels.musicbrainz, ...record.rawGenreLabels.discogs],
      normalizedGenres: record.normalizedGenres,
    })),
  };
}
