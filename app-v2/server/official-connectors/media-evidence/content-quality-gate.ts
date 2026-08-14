import type { OfficialEventEvidence } from '../types';

export interface ContentQualityGateResult {
  passed: boolean;
  reasons: string[];
}

export function runContentQualityGate(evidence: OfficialEventEvidence): ContentQualityGateResult {
  const reasons: string[] = [];

  if (evidence.enrichmentGaps.includes('lineup_evidence_conflict')) {
    reasons.push('lineup_evidence_conflict');
  }

  const publishedMediaActs = evidence.lineupCandidates.filter(
    (act) => act.evidenceOrigin === 'official_media',
  );
  if (
    evidence.enrichmentGaps.includes('lineup_media_ambiguous') &&
    publishedMediaActs.length > 0
  ) {
    reasons.push('lineup_media_ambiguous');
  }

  const audit = evidence.evidenceAudit;
  if (audit?.lineupBlocks.some((block) => block.rawLines.length > 0)) {
    const hasLineup = evidence.lineupCandidates.length > 0;
    const hasGap =
      evidence.enrichmentGaps.includes('lineup_media_required') ||
      evidence.enrichmentGaps.includes('lineup_not_announced') ||
      evidence.enrichmentGaps.includes('media_ocr_unreadable');
    if (!hasLineup && !hasGap) {
      reasons.push('unaccounted_lineup_block');
    }
  }

  if (audit?.unmappedGenreLabels && audit.unmappedGenreLabels.length > 0) {
    for (const label of audit.unmappedGenreLabels) {
      if (!evidence.enrichmentGaps.some((gap) => gap === `genre_label_unmapped:${label}`)) {
        reasons.push(`unaccounted_genre_label:${label}`);
      }
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}
