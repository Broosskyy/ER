/**
 * A broad discovery catalog must not inspect the same first 40 cities/events
 * every time. Sample a different deterministic 6-hour slot, while favoring
 * official-source refreshes and high-relevance electronic music hints.
 *
 * Existing published sources are excluded from discovery unless they are part
 * of the explicitly scheduled refresh. This is NOT the identity/dedupe gate:
 * the write planner independently checks every selected new event again.
 */
export function selectRotatingRausgegangenDetails<T extends {
  eventSlug: string;
  regionSlug: string;
  relevance: string;
}>(
  candidates: readonly T[],
  options: {
    preferredSlugs?: ReadonlySet<string>;
    knownSlugs?: ReadonlySet<string>;
    slot: number;
    limit: number;
  },
): T[] {
  const { preferredSlugs = new Set(), knownSlugs = new Set(), slot, limit } = options;
  if (!Number.isInteger(limit) || limit < 0 || limit > 500 ||
      !Number.isFinite(slot)) throw new Error('invalid_detail_selection_limits');
  function hash(text: string): number {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }
  function relevanceRank(relevance: string): number {
    if (relevance === 'HIGH_RELEVANCE') return 0;
    if (relevance === 'LIKELY_RELEVANT') return 1;
    if (relevance === 'AMBIGUOUS') return 2;
    return 3;
  }
  return candidates
    .filter(event => preferredSlugs.has(event.eventSlug) ||
      !knownSlugs.has(event.eventSlug))
    .slice()
    .sort((a, b) => {
      const preferredDelta = Number(preferredSlugs.has(b.eventSlug)) -
        Number(preferredSlugs.has(a.eventSlug));
      if (preferredDelta) return preferredDelta;
      const rankDelta = relevanceRank(a.relevance) - relevanceRank(b.relevance);
      if (rankDelta) return rankDelta;
      const ah = hash(`${Math.trunc(slot)}:${a.regionSlug}:${a.eventSlug}`);
      const bh = hash(`${Math.trunc(slot)}:${b.regionSlug}:${b.eventSlug}`);
      return ah - bh || a.eventSlug.localeCompare(b.eventSlug);
    })
    .slice(0, limit);
}
