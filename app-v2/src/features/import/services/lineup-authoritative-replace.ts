import type { ArtistRecord } from '@/data/types/records';
import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { readLineupMetadata } from '@/features/import/services/import-lineup-from-record';
import type {
  LineupArtistSource,
  LineupCompleteness,
} from '@/features/import/services/import-title-lineup-resolver';

const STRUCTURED_SOURCES = new Set(['json_ld', 'html_lineup', 'structured', 'source_lineup']);

function hasStructuredLineupEvidence(record: ImportRecord): boolean {
  const { lineupEntries } = readLineupMetadata(record);
  if (lineupEntries?.some((entry) => STRUCTURED_SOURCES.has(entry.source ?? ''))) {
    return true;
  }
  if ((lineupEntries?.length ?? 0) > 0) {
    return true;
  }
  const candidate = getEffectiveCandidate(record);
  return (candidate.artistNames?.length ?? 0) > 0;
}

/** Replace canonical lineup entirely from structured import when canonical has drifted extras. */
export function shouldAuthoritativeStructuredLineupReplace(
  record: ImportRecord,
  prioritized: { names: string[]; source: LineupArtistSource; completeness: LineupCompleteness },
  existingArtistIds: string[],
  artistsById: Map<string, Pick<ArtistRecord, 'name'>>,
): boolean {
  if (prioritized.names.length === 0 || !hasStructuredLineupEvidence(record)) {
    return false;
  }

  const importKeys = new Set(prioritized.names.map((name) => normalizeMatchText(name)));
  const canonicalNames = existingArtistIds
    .map((id) => artistsById.get(id)?.name)
    .filter((name): name is string => Boolean(name) && !isLineupPlaceholderArtist(name));

  const extraCanonical = canonicalNames.filter(
    (name) => !importKeys.has(normalizeMatchText(name)),
  );
  if (extraCanonical.length > 0) {
    return true;
  }

  return existingArtistIds.some((id) => isLineupPlaceholderArtist(artistsById.get(id)?.name));
}
