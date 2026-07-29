import type { PublishPolicyConfig } from '@/features/import/domain/publish-mode';
import type { ImportRecord } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import type {
  TrustPublishEvaluation,
  TrustQualityDecision,
  TrustQualityRule,
  TrustQualityRuleViolation,
} from '../domain/trust-quality-types';
import { resolveTrustQualityThresholds } from '../domain/trust-quality-config';
import { ImportRecordQualityEvaluator } from './import-record-quality-evaluator';
import { SourceTrustEngine } from './source-trust-engine';

const DECISION_PRIORITY: Record<TrustQualityDecision, number> = {
  reject: 4,
  hold: 3,
  review_required: 2,
  auto_publish: 1,
};

function mapImpactToDecision(impact: TrustQualityRuleViolation['decisionImpact']): TrustQualityDecision | null {
  if (impact === 'none') {
    return null;
  }
  if (impact === 'reject') return 'reject';
  if (impact === 'hold') return 'hold';
  return 'review_required';
}

function mergeDecision(current: TrustQualityDecision, next: TrustQualityDecision): TrustQualityDecision {
  return DECISION_PRIORITY[next] > DECISION_PRIORITY[current] ? next : current;
}

export interface TrustPublishDecisionInput {
  source: SourceRecord;
  record: ImportRecord;
  policy?: PublishPolicyConfig;
  rules: TrustQualityRule[];
}

export class TrustPublishDecisionEngine {
  constructor(
    private readonly qualityEvaluator: ImportRecordQualityEvaluator,
    private readonly trustEngine: SourceTrustEngine,
  ) {}

  evaluate(input: TrustPublishDecisionInput): TrustPublishEvaluation {
    const thresholds = resolveTrustQualityThresholds({
      minTrustScore: input.policy?.minTrustScore,
      duplicateThreshold: undefined,
    });
    const quality = this.qualityEvaluator.evaluate(input.record, input.rules);
    const { trustScore, factors } = this.trustEngine.getEffectiveTrust(input.source);

    let decision: TrustQualityDecision = 'auto_publish';
    const reasons: string[] = [];
    const affectedFields = new Set<string>();
    const ruleIds: string[] = [];

    if (input.record.status === 'rejected' || input.record.status === 'imported') {
      return this.buildResult('reject', quality, trustScore, ['record_terminal_status'], [], [], quality.violations);
    }

    if (trustScore < thresholds.rejectTrustScore) {
      decision = mergeDecision(decision, 'reject');
      reasons.push('source_trust_below_reject_threshold');
    } else if (trustScore < thresholds.holdTrustScore) {
      decision = mergeDecision(decision, 'hold');
      reasons.push('source_trust_below_hold_threshold');
    } else if (trustScore < thresholds.minTrustScore) {
      decision = mergeDecision(decision, 'review_required');
      reasons.push('source_trust_below_publish_threshold');
    }

    for (const violation of quality.violations) {
      const violationDecision = mapImpactToDecision(violation.decisionImpact);
      if (!violationDecision) {
        continue;
      }
      decision = mergeDecision(decision, violationDecision);
      reasons.push(violation.message);
      ruleIds.push(violation.ruleId);
      violation.affectedFields.forEach((field) => affectedFields.add(field));
    }

    if (input.policy?.mode === 'manual_review') {
      decision = mergeDecision(decision, 'review_required');
      reasons.push('manual_review_publish_mode');
    }

    if (quality.score < thresholds.minQualityScoreForAutoPublish) {
      decision = mergeDecision(decision, 'review_required');
      reasons.push('quality_score_below_auto_publish_threshold');
    }

    if (input.policy?.mode === 'auto_publish' && decision === 'auto_publish') {
      if (input.record.status !== 'approved' && input.record.status !== 'needs_review') {
        decision = 'review_required';
        reasons.push('record_not_publish_ready');
      }
    }

    if (factors.length > 0) {
      reasons.push(...factors.map((factor) => `trust_factor:${factor}`));
    }

    return this.buildResult(
      decision,
      quality,
      trustScore,
      reasons,
      [...affectedFields],
      ruleIds,
      quality.violations,
    );
  }

  private buildResult(
    decision: TrustQualityDecision,
    quality: TrustPublishEvaluation['quality'],
    trustScore: number,
    reasons: string[],
    affectedFields: string[],
    ruleIds: string[],
    violations: TrustQualityRuleViolation[],
  ): TrustPublishEvaluation {
    return {
      decision,
      qualityScore: quality.score,
      trustScore,
      reasons,
      affectedFields,
      ruleIds,
      violations,
      quality,
    };
  }
}

export const trustPublishDecisionEngine = new TrustPublishDecisionEngine(
  new ImportRecordQualityEvaluator(),
  new SourceTrustEngine(),
);
