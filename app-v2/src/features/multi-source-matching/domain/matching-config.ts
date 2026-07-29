import type { MatchConfidenceTier } from './matching-types';

export interface MatchConfidenceThresholds {
  certainMinScore: number;
  probableMinScore: number;
  autoLinkMinScore: number;
  reviewRequiredMinScore: number;
}

export const DEFAULT_MATCH_CONFIDENCE_THRESHOLDS: MatchConfidenceThresholds = {
  certainMinScore: 90,
  probableMinScore: 70,
  autoLinkMinScore: 90,
  reviewRequiredMinScore: 70,
};

export interface MatchSignalWeight {
  type: string;
  weight: number;
}

export const DEFAULT_MATCH_SIGNAL_WEIGHTS: MatchSignalWeight[] = [
  { type: 'source_reference', weight: 1 },
  { type: 'fingerprint', weight: 0.95 },
  { type: 'external_id', weight: 1 },
  { type: 'title_similarity', weight: 0.85 },
  { type: 'start_date', weight: 0.8 },
  { type: 'venue', weight: 0.9 },
  { type: 'coordinates', weight: 0.85 },
  { type: 'ticket_url', weight: 0.9 },
  { type: 'event_url', weight: 0.85 },
  { type: 'organizer', weight: 0.7 },
  { type: 'artist_overlap', weight: 0.75 },
  { type: 'blocking_key', weight: 0.6 },
];

export function resolveMatchConfidenceThresholds(
  overrides?: Partial<MatchConfidenceThresholds>,
): MatchConfidenceThresholds {
  return {
    ...DEFAULT_MATCH_CONFIDENCE_THRESHOLDS,
    ...overrides,
  };
}

export function resolveConfidenceTier(
  score: number,
  thresholds: MatchConfidenceThresholds = DEFAULT_MATCH_CONFIDENCE_THRESHOLDS,
): MatchConfidenceTier {
  if (score >= thresholds.certainMinScore) {
    return 'certain';
  }
  if (score >= thresholds.probableMinScore) {
    return 'probable';
  }
  return 'uncertain';
}

export function resolveMatchDecision(
  score: number,
  thresholds: MatchConfidenceThresholds = DEFAULT_MATCH_CONFIDENCE_THRESHOLDS,
): 'auto_link' | 'review_required' | 'keep_separate' {
  if (score >= thresholds.autoLinkMinScore) {
    return 'auto_link';
  }
  if (score >= thresholds.reviewRequiredMinScore) {
    return 'review_required';
  }
  return 'keep_separate';
}
