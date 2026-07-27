import type {
  SourceHealthStatus,
  SourceRegistryEntry,
} from '@/features/sources/domain/source-registry';

export interface SourceHealthResult {
  status: SourceHealthStatus;
  score: number;
  reasons: string[];
  recommendations: string[];
  calculatedAt: string;
  metrics: {
    successRate?: number;
    consecutiveFailureCount: number;
    errorRate: number;
    duplicateRate: number;
    averageDurationMs?: number;
    lastSuccessfulSyncAt?: string;
  };
}

export const SOURCE_HEALTH_POLICY = {
  warningFailureCount: 2,
  degradedFailureCount: 3,
  criticalFailureCount: 5,
  staleAfterHours: 72,
} as const;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hoursSince(value: string, now: Date): number {
  return (now.getTime() - new Date(value).getTime()) / 3_600_000;
}

export class SourceHealthResolver {
  resolve(source: SourceRegistryEntry, now = new Date()): SourceHealthResult {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    const hasImportHistory = source.totalImportCount > 0;

    if (!hasImportHistory) {
      return {
        status: 'unknown',
        score: 0,
        reasons: ['No completed import history is available.'],
        recommendations: ['Run a test import before enabling scheduled sync.'],
        calculatedAt: now.toISOString(),
        metrics: {
          consecutiveFailureCount: source.consecutiveFailureCount,
          errorRate: source.errorRate,
          duplicateRate: source.duplicateRate,
          averageDurationMs: source.averageDurationMs,
          lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
        },
      };
    }

    const validRate = source.totalValidEventCount /
      Math.max(1, source.totalValidEventCount + source.totalRejectedEventCount);
    const successRate = Math.max(0, 1 - source.errorRate);
    let score = successRate * 50 + validRate * 30 + (1 - source.duplicateRate) * 20;

    if (source.consecutiveFailureCount >= SOURCE_HEALTH_POLICY.criticalFailureCount) {
      score = Math.min(score, 20);
      reasons.push('Repeated import failures reached the critical threshold.');
      recommendations.push('Pause the source and investigate the connector or credentials.');
    } else if (source.consecutiveFailureCount >= SOURCE_HEALTH_POLICY.degradedFailureCount) {
      score = Math.min(score, 49);
      reasons.push('Repeated import failures degrade source reliability.');
      recommendations.push('Run a test import and review recent errors.');
    } else if (source.consecutiveFailureCount >= SOURCE_HEALTH_POLICY.warningFailureCount) {
      score = Math.min(score, 69);
      reasons.push('Recent import failures require observation.');
      recommendations.push('Monitor the next successful import.');
    }

    if (
      source.lastSuccessfulSyncAt &&
      hoursSince(source.lastSuccessfulSyncAt, now) > SOURCE_HEALTH_POLICY.staleAfterHours
    ) {
      score -= 20;
      reasons.push('The last successful synchronization is stale.');
      recommendations.push('Run a manual import before relying on the source.');
    }

    if (source.errorRate >= 0.25) {
      reasons.push('The source error rate is at least 25%.');
    }
    if (source.duplicateRate >= 0.5) {
      score -= 10;
      reasons.push('The source produces a high duplicate rate.');
      recommendations.push('Review source identity and duplicate blocking keys.');
    }

    const normalizedScore = clampScore(score);
    const status: SourceHealthStatus =
      source.consecutiveFailureCount >= SOURCE_HEALTH_POLICY.criticalFailureCount || normalizedScore < 30
        ? 'critical'
        : source.consecutiveFailureCount >= SOURCE_HEALTH_POLICY.degradedFailureCount || normalizedScore < 50
          ? 'degraded'
          : source.consecutiveFailureCount >= SOURCE_HEALTH_POLICY.warningFailureCount || normalizedScore < 75
            ? 'warning'
            : 'healthy';

    return {
      status,
      score: normalizedScore,
      reasons: reasons.length > 0 ? reasons : ['Import success and validation metrics are stable.'],
      recommendations,
      calculatedAt: now.toISOString(),
      metrics: {
        successRate,
        consecutiveFailureCount: source.consecutiveFailureCount,
        errorRate: source.errorRate,
        duplicateRate: source.duplicateRate,
        averageDurationMs: source.averageDurationMs,
        lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
      },
    };
  }
}

export const sourceHealthResolver = new SourceHealthResolver();
