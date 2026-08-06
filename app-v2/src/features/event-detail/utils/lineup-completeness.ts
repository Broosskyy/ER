export type LineupEvidenceKind = 'structured' | 'title_inferred' | 'unknown';

export function inferLineupCompleteness(
  event: { title: string; lineupEvidence?: LineupEvidenceKind },
  artistCount: number,
): 'full' | 'partial' | 'none' {
  if (artistCount === 0) {
    return 'none';
  }
  if (event.lineupEvidence === 'structured') {
    return 'full';
  }
  if (artistCount > 2) {
    return 'full';
  }
  const title = event.title.toLowerCase();
  const titleDerivedPattern = /\b(pres\.?|w\/|ft\.?|feat\.?|featuring|x)\b/i;
  if (titleDerivedPattern.test(title) && artistCount <= 2) {
    return 'partial';
  }
  if (event.lineupEvidence === 'title_inferred') {
    return 'partial';
  }
  return artistCount === 1 ? 'full' : 'full';
}

export function resolveLineupSectionTitle(
  completeness: 'full' | 'partial' | 'none',
  artistCount = 0,
): string {
  if (completeness === 'none') {
    return 'LINE-UP';
  }
  if (completeness === 'partial' && artistCount === 1) {
    return 'ARTIST';
  }
  if (completeness === 'partial') {
    return 'BEKANNTE ARTISTS';
  }
  return 'LINE-UP';
}
