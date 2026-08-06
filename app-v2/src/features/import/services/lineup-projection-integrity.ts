import type { ArtistRecord } from '@/data/types/records';
import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';

export type LineupRepairReason =
  | 'no_import_lineup'
  | 'empty_canonical'
  | 'placeholder_only'
  | 'invalid_artists_present'
  | 'partial_canonical'
  | 'import_richer_than_canonical'
  | 'canonical_superset_of_import'
  | 'sufficient';

export interface LineupRepairAssessment {
  shouldRepair: boolean;
  reason: LineupRepairReason;
  importNameCount: number;
  validCanonicalCount: number;
  invalidCanonicalCount: number;
  importNames: string[];
}

export function filterValidLineupArtistIds(
  artistIds: string[],
  artistsById: Map<string, Pick<ArtistRecord, 'name'>>,
): string[] {
  return artistIds.filter((id) => {
    const name = artistsById.get(id)?.name;
    return Boolean(name) && !isLineupPlaceholderArtist(name);
  });
}

export function countInvalidLineupArtistIds(
  artistIds: string[],
  artistsById: Map<string, Pick<ArtistRecord, 'name'>>,
): number {
  return artistIds.length - filterValidLineupArtistIds(artistIds, artistsById).length;
}

function canonicalCoversImportNames(
  importNames: string[],
  artistIds: string[],
  artistsById: Map<string, Pick<ArtistRecord, 'name'>>,
): boolean {
  const canonicalNames = new Set(
    filterValidLineupArtistIds(artistIds, artistsById).map(
      (id) => normalizeMatchText(artistsById.get(id)?.name ?? ''),
    ),
  );
  return importNames.every((name) => canonicalNames.has(normalizeMatchText(name)));
}

/** Whether publish/repair should rewrite event_artists from this import record. */
export function assessLineupRepairNeed(
  record: ImportRecord,
  existingArtistIds: string[],
  artistsById: Map<string, Pick<ArtistRecord, 'name'>>,
): LineupRepairAssessment {
  const prioritized = extractPrioritizedArtistNames(record);
  const importNames = prioritized.names;
  const validCanonical = filterValidLineupArtistIds(existingArtistIds, artistsById);
  const invalidCanonicalCount = existingArtistIds.length - validCanonical.length;

  if (invalidCanonicalCount > 0) {
    return {
      shouldRepair: true,
      reason: 'invalid_artists_present',
      importNameCount: importNames.length,
      validCanonicalCount: validCanonical.length,
      invalidCanonicalCount,
      importNames,
    };
  }

  if (importNames.length === 0) {
    return {
      shouldRepair: false,
      reason: 'no_import_lineup',
      importNameCount: 0,
      validCanonicalCount: validCanonical.length,
      invalidCanonicalCount,
      importNames,
    };
  }

  if (existingArtistIds.length === 0) {
    return {
      shouldRepair: true,
      reason: 'empty_canonical',
      importNameCount: importNames.length,
      validCanonicalCount: 0,
      invalidCanonicalCount: 0,
      importNames,
    };
  }

  if (validCanonical.length === 0 && existingArtistIds.length > 0) {
    return {
      shouldRepair: true,
      reason: 'placeholder_only',
      importNameCount: importNames.length,
      validCanonicalCount: 0,
      invalidCanonicalCount,
      importNames,
    };
  }

  if (validCanonical.length < importNames.length) {
    return {
      shouldRepair: true,
      reason: 'partial_canonical',
      importNameCount: importNames.length,
      validCanonicalCount: validCanonical.length,
      invalidCanonicalCount,
      importNames,
    };
  }

  if (validCanonical.length > importNames.length) {
    const importKeys = new Set(importNames.map((name) => normalizeMatchText(name)));
    const hasExtraCanonical = validCanonical.some(
      (id) => !importKeys.has(normalizeMatchText(artistsById.get(id)?.name ?? '')),
    );
    if (hasExtraCanonical) {
      return {
        shouldRepair: true,
        reason: 'canonical_superset_of_import',
        importNameCount: importNames.length,
        validCanonicalCount: validCanonical.length,
        invalidCanonicalCount,
        importNames,
      };
    }
  }

  if (!canonicalCoversImportNames(importNames, existingArtistIds, artistsById)) {
    return {
      shouldRepair: true,
      reason: 'import_richer_than_canonical',
      importNameCount: importNames.length,
      validCanonicalCount: validCanonical.length,
      invalidCanonicalCount,
      importNames,
    };
  }

  return {
    shouldRepair: false,
    reason: 'sufficient',
    importNameCount: importNames.length,
    validCanonicalCount: validCanonical.length,
    invalidCanonicalCount,
    importNames,
  };
}

export function pickBestImportRecordForLineupRepair(
  records: ImportRecord[],
  existingArtistIds: string[],
  artistsById: Map<string, Pick<ArtistRecord, 'name'>>,
): { record: ImportRecord; assessment: LineupRepairAssessment } | null {
  let best: { record: ImportRecord; assessment: LineupRepairAssessment } | null = null;

  for (const record of records) {
    const assessment = assessLineupRepairNeed(record, existingArtistIds, artistsById);
    if (!assessment.shouldRepair && assessment.importNameCount === 0) {
      continue;
    }
    if (
      !best ||
      assessment.importNameCount > best.assessment.importNameCount ||
      (assessment.shouldRepair && !best.assessment.shouldRepair)
    ) {
      best = { record, assessment };
    }
  }

  if (!best || best.assessment.importNameCount === 0) {
    return null;
  }
  return best;
}
