import type { TrustQualityThresholds } from './trust-quality-types';

export const DEFAULT_TRUST_QUALITY_THRESHOLDS: TrustQualityThresholds = {
  minTrustScore: 70,
  minExtractionConfidence: 0.6,
  minQualityScoreForAutoPublish: 65,
  duplicateThreshold: 70,
  rejectTrustScore: 25,
  holdTrustScore: 45,
};

export interface TrustScoreAdjustmentRule {
  eventType: string;
  delta: number;
  minScore: number;
  maxScore: number;
}

export const DEFAULT_TRUST_SCORE_ADJUSTMENTS: TrustScoreAdjustmentRule[] = [
  { eventType: 'import_success', delta: 0.5, minScore: 0, maxScore: 100 },
  { eventType: 'import_failure', delta: -2, minScore: 0, maxScore: 100 },
  { eventType: 'publish_success', delta: 0.25, minScore: 0, maxScore: 100 },
  { eventType: 'publish_queued', delta: -0.25, minScore: 0, maxScore: 100 },
  { eventType: 'publish_rejected', delta: -1, minScore: 0, maxScore: 100 },
  { eventType: 'manual_correction', delta: -1.5, minScore: 0, maxScore: 100 },
  { eventType: 'quality_improvement', delta: 0.75, minScore: 0, maxScore: 100 },
  { eventType: 'quality_regression', delta: -0.75, minScore: 0, maxScore: 100 },
];

export function resolveTrustQualityThresholds(
  overrides?: Partial<TrustQualityThresholds>,
): TrustQualityThresholds {
  return {
    ...DEFAULT_TRUST_QUALITY_THRESHOLDS,
    ...overrides,
  };
}
