import { classifyRelevanceEvidence } from '../ticket-evidence/network-discovery/relevance-evidence';
import type { LocationQualificationState, LocationSurfaceCandidate } from './discovery-surfaces';
import { extractLocationSlugFromUrl } from './location-url';

export interface LocationCandidateSeed {
  locationUrl: string;
  evidenceSources: string[];
  observedTitles: string[];
  observedGenreHints: string[];
}

function scoreLocationCandidate(seed: LocationCandidateSeed): {
  qualification: LocationQualificationState;
  score: number;
  reasons: string[];
  observedElectronicEvents: number;
  observedUpcomingEvents: number;
} {
  const reasons: string[] = [];
  let score = 0;
  let electronicEvents = 0;

  for (const title of seed.observedTitles) {
    const relevance = classifyRelevanceEvidence({ title, detailAccess: 'NOT_FETCHED' });
    if (relevance.relevance === 'HIGH_RELEVANCE' || relevance.relevance === 'LIKELY_RELEVANT') {
      electronicEvents += 1;
      score += relevance.relevance === 'HIGH_RELEVANCE' ? 3 : 2;
      reasons.push(`electronic_listing_title:${title.slice(0, 40)}`);
    } else if (relevance.relevance === 'AMBIGUOUS') {
      score += 1;
    }
  }

  if (seed.observedGenreHints.some((genre) => /\b(?:techno|house|trance|electronic|rave)\b/i.test(genre))) {
    score += 4;
    reasons.push('explicit_genre_hint_on_surface');
  }

  if (seed.evidenceSources.includes('staging_venue')) {
    score += 2;
    reasons.push('staging_venue_binding');
  }
  if (seed.evidenceSources.includes('detail_venue_link')) {
    score += 2;
    reasons.push('detail_venue_link');
  }
  if (seed.evidenceSources.includes('recursive_expansion')) {
    score += 1;
    reasons.push('recursive_expansion');
  }

  const observedUpcoming = seed.observedTitles.length;
  let qualification: LocationQualificationState = 'UNRESOLVED';
  if (score >= 8 || electronicEvents >= 3) {
    qualification = 'HIGH_VALUE';
  } else if (score >= 4 || electronicEvents >= 1) {
    qualification = 'LIKELY_VALUE';
  } else if (score <= 0 && observedUpcoming === 0) {
    qualification = 'LOW_VALUE';
  }

  return {
    qualification,
    score,
    reasons,
    observedElectronicEvents: electronicEvents,
    observedUpcomingEvents: observedUpcoming,
  };
}

export function qualifyLocationSurfaceCandidates(
  seeds: LocationCandidateSeed[],
): LocationSurfaceCandidate[] {
  const byUrl = new Map<string, LocationCandidateSeed>();
  for (const seed of seeds) {
    const existing = byUrl.get(seed.locationUrl);
    if (!existing) {
      byUrl.set(seed.locationUrl, { ...seed, observedTitles: [...seed.observedTitles], observedGenreHints: [...seed.observedGenreHints] });
      continue;
    }
    existing.evidenceSources.push(...seed.evidenceSources.filter((source) => !existing.evidenceSources.includes(source)));
    existing.observedTitles.push(...seed.observedTitles);
    existing.observedGenreHints.push(...seed.observedGenreHints);
  }

  return [...byUrl.entries()].map(([locationUrl, seed]) => {
    const scored = scoreLocationCandidate(seed);
    const slug = extractLocationSlugFromUrl(locationUrl) ?? 'unknown';
    return {
      locationSlug: slug,
      locationUrl,
      evidenceSources: [...new Set(seed.evidenceSources)],
      observedElectronicEvents: scored.observedElectronicEvents,
      observedUpcomingEvents: scored.observedUpcomingEvents,
      qualification: scored.qualification,
      qualificationScore: scored.score,
      qualificationReasons: scored.reasons,
    };
  });
}

export function selectLocationSurfacesToCrawl(
  candidates: LocationSurfaceCandidate[],
  maxSurfaces: number,
): LocationSurfaceCandidate[] {
  const priority: Record<LocationQualificationState, number> = {
    HIGH_VALUE: 4,
    LIKELY_VALUE: 3,
    UNRESOLVED: 2,
    LOW_VALUE: 1,
  };

  return candidates
    .slice()
    .sort((left, right) => priority[right.qualification] - priority[left.qualification] || right.qualificationScore - left.qualificationScore)
    .filter((candidate) => candidate.qualification !== 'LOW_VALUE')
    .slice(0, maxSurfaces);
}
