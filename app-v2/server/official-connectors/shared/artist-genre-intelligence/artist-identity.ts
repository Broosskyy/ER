import { canonicalActKey, normalizeLineupName } from '../lineup-normalization';

export function normalizeArtistDisplayName(name: string): string {
  return normalizeLineupName(name);
}

const NAME_PARTICLES = new Set(['de', 'van', 'von', 'der', 'den', 'di', 'du', 'la', 'le', 'mc', 'dj']);

function titleCaseArtistName(name: string): string {
  const parts = normalizeLineupName(name).toLowerCase().split(/\s+/).filter(Boolean);
  return parts
    .map((part, index) => {
      if (part === 'dj') {
        return 'DJ';
      }
      if (index > 0 && NAME_PARTICLES.has(part)) {
        return part;
      }
      return part.length <= 2 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(' ');
}

export function toArtistSearchName(name: string): string {
  const normalized = normalizeLineupName(name);
  if (normalized.length >= 3 && normalized === normalized.toUpperCase() && /[A-Z]/.test(normalized)) {
    return titleCaseArtistName(normalized);
  }
  return normalized;
}

export function artistSearchNameVariants(name: string): string[] {
  const normalized = normalizeLineupName(name);
  const titleCase = toArtistSearchName(name);
  const lower = normalized.toLowerCase();
  const variants = [normalized, titleCase, lower];
  return [...new Set(variants.filter(Boolean))];
}

export function getArtistIdentityKey(name: string): string {
  return canonicalActKey(name);
}

export function expandLineupActsForProfileLookup(lineup: string[]): string[] {
  const expanded: string[] = [];
  for (const act of lineup) {
    if (/\bb2b\b/i.test(act)) {
      for (const part of act.split(/\bb2b\b/i)) {
        const normalized = normalizeArtistDisplayName(part);
        if (normalized) {
          expanded.push(normalized);
        }
      }
      continue;
    }
    expanded.push(act);
  }
  return [...new Set(expanded)];
}

export function artistNamesEquivalent(left: string, right: string): boolean {
  return getArtistIdentityKey(left) === getArtistIdentityKey(right);
}

const EVENT_TITLE_MARKERS =
  /\b(?:bootshaus|kit\s*kat|kitkat|affenk[äa]fig|halloween|mdma|open\s*air|festival|warehouse|nye|capitol|ship|rules|session|airport|polyamor)\b/i;

export function extractHeadlinerFromTitle(title: string): string | undefined {
  const cleaned = title.replace(/[!?]+$/g, '').trim();
  const presMatch = cleaned.match(/^(.+?)\s+pres\.?\s+(?:by\s+)?/i);
  if (presMatch?.[1]) {
    const candidate = normalizeArtistDisplayName(presMatch[1]);
    if (candidate && candidate.length >= 3 && !EVENT_TITLE_MARKERS.test(candidate)) {
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
  if (
    cleaned.length >= 3 &&
    cleaned.length <= 48 &&
    !EVENT_TITLE_MARKERS.test(cleaned) &&
    !/\d{1,2}\.\d{1,2}/.test(cleaned) &&
    !/\b(?:vol\.?|volume|edition|jahr|jahre|years)\b/i.test(cleaned)
  ) {
    const candidate = normalizeArtistDisplayName(cleaned);
    if (candidate && candidate.split(/\s+/).length <= 4) {
      return candidate;
    }
  }
  return undefined;
}
