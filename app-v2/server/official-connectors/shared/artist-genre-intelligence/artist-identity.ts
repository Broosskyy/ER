import { canonicalActKey, normalizeLineupName } from '../lineup-normalization';

export function normalizeArtistDisplayName(name: string): string {
  return normalizeLineupName(name);
}

export function getArtistIdentityKey(name: string): string {
  return canonicalActKey(name);
}

export function artistNamesEquivalent(left: string, right: string): boolean {
  return getArtistIdentityKey(left) === getArtistIdentityKey(right);
}

export function extractHeadlinerFromTitle(title: string): string | undefined {
  const cleaned = title.replace(/[!?]+$/g, '').trim();
  const presMatch = cleaned.match(/^(.+?)\s+pres\.?\s+(?:by\s+)?/i);
  if (presMatch?.[1]) {
    const candidate = normalizeArtistDisplayName(presMatch[1]);
    if (candidate && candidate.length >= 3 && !/\b(?:bootshaus|kitkat|affenkäfig)\b/i.test(candidate)) {
      return candidate;
    }
  }
  const pipeMatch = cleaned.match(/\|\s*([^|]+)$/);
  if (pipeMatch?.[1] && !/\d{4}/.test(pipeMatch[1])) {
    const candidate = normalizeArtistDisplayName(pipeMatch[1]);
    if (candidate && candidate.length >= 3) {
      return candidate;
    }
  }
  return undefined;
}
