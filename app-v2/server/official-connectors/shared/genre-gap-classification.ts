import type { OfficialEventEvidence } from '../types';
import type { EventMediaEvidence } from '../media-evidence/types';

export type ClassifiedGenreGap =
  | 'genre_not_announced'
  | 'genre_evidence_insufficient'
  | 'genre_label_unmapped'
  | 'genre_evidence_conflict';

export function classifyGenreEvidenceGaps(
  evidence: OfficialEventEvidence,
  mediaEvidence?: EventMediaEvidence,
): ClassifiedGenreGap[] {
  const gaps: ClassifiedGenreGap[] = [];

  if (evidence.explicitGenreLabels.length > 0) {
    return gaps;
  }

  const hasUnmapped = evidence.enrichmentGaps.some((gap) => gap.startsWith('genre_label_unmapped:'));
  if (hasUnmapped) {
    gaps.push('genre_label_unmapped');
    return gaps;
  }

  if (evidence.enrichmentGaps.includes('lineup_evidence_conflict')) {
    gaps.push('genre_evidence_conflict');
  }

  const genresContainerHidden = evidence.enrichmentGaps.includes('genres_media_required');
  const mediaUnreadable = evidence.enrichmentGaps.includes('media_ocr_unreadable');
  const mediaHasGenreCandidates = (mediaEvidence?.genreCandidates.length ?? 0) > 0;

  if (mediaHasGenreCandidates) {
    gaps.push('genre_evidence_insufficient');
    return gaps;
  }

  if (genresContainerHidden && !mediaUnreadable) {
    gaps.push('genre_evidence_insufficient');
    return gaps;
  }

  if (genresContainerHidden && mediaUnreadable) {
    gaps.push('genre_evidence_insufficient');
    return gaps;
  }

  if (evidence.enrichmentGaps.includes('genres_missing')) {
    gaps.push('genre_not_announced');
    return gaps;
  }

  gaps.push('genre_evidence_insufficient');
  return gaps;
}

export function replaceLegacyGenreGaps(enrichmentGaps: string[]): string[] {
  const withoutLegacy = enrichmentGaps.filter((gap) => gap !== 'genres_media_required' && gap !== 'genres_missing');
  return withoutLegacy;
}
