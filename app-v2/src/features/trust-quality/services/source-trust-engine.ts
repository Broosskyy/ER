import type { SourceRecord } from '@/data/types/records';
import { buildSourceTrustMetrics, type SourceTrustMetrics } from '@/features/sources/domain/source-trust-metrics';
import {
  DEFAULT_TRUST_SCORE_ADJUSTMENTS,
  resolveTrustQualityThresholds,
  type TrustScoreAdjustmentRule,
} from '../domain/trust-quality-config';
import type { SourceReputationEventType } from '../domain/trust-quality-types';

export interface EffectiveSourceTrust {
  trustScore: number;
  metrics: SourceTrustMetrics;
  factors: string[];
}

export class SourceTrustEngine {
  constructor(
    private readonly adjustments: TrustScoreAdjustmentRule[] = DEFAULT_TRUST_SCORE_ADJUSTMENTS,
  ) {}

  getEffectiveTrust(source: SourceRecord): EffectiveSourceTrust {
    const metrics = buildSourceTrustMetrics({
      trustScore: source.computedTrustScore ?? source.trustScore,
      consecutiveFailures: source.consecutiveFailureCount,
      duplicateRate: source.duplicateRate,
      lastSuccessAt: source.lastSuccessfulSyncAt,
      lastFailureAt: source.lastFailedImportAt,
      totalImportCount: source.totalImportCount,
      totalValidEventCount: source.totalValidEventCount,
      totalRejectedEventCount: source.totalRejectedEventCount,
      errorRate: source.errorRate,
      updateRate: source.updateRate,
    });

    const factors: string[] = [];
    let adjusted = metrics.trustScore;

    if (metrics.errorRate > 0.2) {
      adjusted -= metrics.errorRate * 20;
      factors.push('high_error_rate');
    }
    if ((metrics.duplicateRate ?? 0) > 0.15) {
      adjusted -= (metrics.duplicateRate ?? 0) * 15;
      factors.push('high_duplicate_rate');
    }
    if (metrics.consecutiveFailures > 0) {
      adjusted -= Math.min(15, metrics.consecutiveFailures * 3);
      factors.push('consecutive_failures');
    }
    if (metrics.importSuccessRate !== undefined && metrics.importSuccessRate > 0.9) {
      adjusted += 2;
      factors.push('stable_import_history');
    }

    const trustScore = clamp(adjusted, 0, 100);
    return { trustScore, metrics, factors };
  }

  applyReputationDelta(currentTrustScore: number, eventType: SourceReputationEventType): number {
    const rule = this.adjustments.find((entry) => entry.eventType === eventType);
    if (!rule) {
      return currentTrustScore;
    }
    return clamp(currentTrustScore + rule.delta, rule.minScore, rule.maxScore);
  }

  isBelowThreshold(source: SourceRecord, thresholdKey: 'minTrustScore' | 'rejectTrustScore' | 'holdTrustScore'): boolean {
    const thresholds = resolveTrustQualityThresholds();
    const { trustScore } = this.getEffectiveTrust(source);
    return trustScore < thresholds[thresholdKey];
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const sourceTrustEngine = new SourceTrustEngine();
