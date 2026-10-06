import { canonicalActKey } from '../../shared/lineup-normalization';
import { extractVerifiedTitleLineupCandidates } from '../../shared/title-lineup-evidence';

function isLineupNoise(value: string): boolean {
  return /^(?:early bird|sold out|tickets?|phase\s*\d+|tba|tbc|tbd|coming soon|folgt|weitere folgen)$/i.test(
    value.trim(),
  );
}

export function mergeLineupHints(eventTitle: string, lineupHints: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const cleaned = value.trim();
    const key = canonicalActKey(cleaned);
    if (!cleaned || !key || isLineupNoise(cleaned) || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(cleaned);
  };

  for (const hint of lineupHints) {
    push(hint);
  }

  const titleEvidence = extractVerifiedTitleLineupCandidates({ eventTitle });
  for (const candidate of titleEvidence.candidates) {
    push(candidate.displayName);
  }

  return merged;
}
