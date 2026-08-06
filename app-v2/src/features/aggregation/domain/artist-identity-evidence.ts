import { normalizeMatchText } from '@/features/import/matching/matching-utils';

/** Generic evidence types for Artist identity and lineup spelling (Phase 4.6.9). */
export type ArtistEvidenceType =
  | 'verified_canonical'
  | 'verified_alias'
  | 'structured_text'
  | 'official_flyer'
  | 'description_text'
  | 'title_inference'
  | 'weak_ocr';

const EVIDENCE_RANK: Record<ArtistEvidenceType, number> = {
  verified_canonical: 100,
  verified_alias: 95,
  structured_text: 85,
  official_flyer: 80,
  description_text: 65,
  title_inference: 40,
  weak_ocr: 20,
};

export function rankArtistEvidence(type: ArtistEvidenceType): number {
  return EVIDENCE_RANK[type];
}

export interface ArtistSpellingCandidate {
  spelling: string;
  source: ArtistEvidenceType;
  confidence: number;
  provenance?: Record<string, unknown>;
}

export interface ArtistSpellingResolution {
  action: 'accept' | 'review';
  displayName?: string;
  preserveSourceSpelling?: string;
  reason: string;
}

/** Whether two spellings are a minor variation (e.g. KARAMUSTA vs KARAMUSTAN). */
export function isMinorArtistSpellingVariation(left: string, right: string): boolean {
  const a = normalizeMatchText(left);
  const b = normalizeMatchText(right);
  if (!a || !b || a === b) {
    return false;
  }
  if (a.startsWith(b) || b.startsWith(a)) {
    return Math.abs(a.length - b.length) <= 2;
  }
  if (Math.abs(a.length - b.length) > 2) {
    return false;
  }
  let mismatches = 0;
  const maxLen = Math.max(a.length, b.length);
  for (let index = 0; index < maxLen; index += 1) {
    if (a[index] !== b[index]) {
      mismatches += 1;
    }
  }
  return mismatches <= 2;
}

/**
 * Resolve a spelling conflict without global source winners.
 * Official flyer may correct a likely textual typo when variation is minor and flyer confidence is high.
 */
export function resolveArtistSpellingConflict(
  candidates: ArtistSpellingCandidate[],
): ArtistSpellingResolution {
  if (candidates.length === 0) {
    return { action: 'review', reason: 'no_candidates' };
  }

  const sorted = [...candidates].sort(
    (left, right) =>
      rankArtistEvidence(right.source) * right.confidence -
      rankArtistEvidence(left.source) * left.confidence,
  );
  const top = sorted[0]!;
  const textual = candidates.find((c) => c.source === 'structured_text');
  const flyer = candidates.find((c) => c.source === 'official_flyer');

  if (textual && flyer && textual.spelling !== flyer.spelling) {
    if (
      isMinorArtistSpellingVariation(textual.spelling, flyer.spelling) &&
      flyer.confidence >= 0.85
    ) {
      return {
        action: 'accept',
        displayName: flyer.spelling,
        preserveSourceSpelling: textual.spelling,
        reason: 'official_flyer_minor_spelling_correction',
      };
    }
    return {
      action: 'review',
      reason: 'textual_flyer_spelling_conflict',
    };
  }

  if (top.confidence >= 0.85 && rankArtistEvidence(top.source) >= 80) {
    return {
      action: 'accept',
      displayName: top.spelling,
      reason: 'decisive_evidence',
    };
  }

  if (top.confidence >= 0.55) {
    return { action: 'review', reason: 'medium_confidence' };
  }

  return { action: 'review', reason: 'low_confidence' };
}
