import type { EventMediaCandidate, EventMediaType } from './event-media-candidate';
import { isAutoSelectableIdentity } from './event-media-candidate';

const MEDIA_TYPE_SCORE: Record<EventMediaType, number> = {
  lineup_flyer: 45,
  event_flyer: 35,
  event_hero: 25,
  announcement_flyer: 15,
  ticket_marketing: -40,
  multi_event_poster: -80,
  organizer_branding: -90,
  venue_branding: -70,
  generic_shop_image: -100,
  decorative_image: -60,
  unknown: -10,
};

const IDENTITY_SCORE: Record<EventMediaCandidate['identityConfidence'], number> = {
  exact_match: 40,
  strong_match: 30,
  review_required: -1000,
  reject: -2000,
};

const SOURCE_SCORE: Record<EventMediaCandidate['sourceType'], number> = {
  primary_official: 10,
  secondary_official: 8,
  verified_ticket_provider: 12,
  verified_supplemental: 10,
  media_ocr: 5,
};

export function scoreEventMediaCandidate(candidate: EventMediaCandidate): number {
  const signals = candidate.contentSignals;
  let score = 0;
  score += IDENTITY_SCORE[candidate.identityConfidence];
  score += MEDIA_TYPE_SCORE[candidate.mediaType];
  score += SOURCE_SCORE[candidate.sourceType];
  score += signals.eventSpecificityScore * 5;
  score += Math.min(signals.lineupOverlapWithVerified, 6) * 8;
  if (signals.ocrConfidence !== undefined) {
    score += Math.min(Math.max(signals.ocrConfidence, 0), 100) / 10;
  }
  if (candidate.mediaType === 'lineup_flyer' && signals.lineupActCount >= 3) {
    score += 20;
  }
  return score;
}

export function rankEventMediaCandidates(candidates: EventMediaCandidate[]): EventMediaCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreEventMediaCandidate(candidate),
    }))
    .sort((left, right) => right.score - left.score);
}

export function isUnsafeMediaCandidate(candidate: EventMediaCandidate): boolean {
  if (!isAutoSelectableIdentity(candidate.identityConfidence)) {
    return true;
  }
  return (
    candidate.mediaType === 'generic_shop_image' ||
    candidate.mediaType === 'multi_event_poster' ||
    candidate.mediaType === 'organizer_branding' ||
    candidate.mediaType === 'venue_branding' ||
    candidate.mediaType === 'ticket_marketing' ||
    candidate.mediaType === 'decorative_image'
  );
}

export function hasConflictingLineup(candidate: EventMediaCandidate): boolean {
  const verifiedOverlap = candidate.contentSignals.lineupOverlapWithVerified;
  const lineupCount = candidate.contentSignals.lineupActCount;
  const ocrConfidence = candidate.contentSignals.ocrConfidence ?? 0;
  if (lineupCount < 3 || verifiedOverlap > 0) {
    return false;
  }
  // Low-confidence OCR must not trigger lineup conflict rejection.
  if (ocrConfidence < 50) {
    return false;
  }
  return true;
}
