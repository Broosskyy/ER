import type { PublishMode, PublishPolicyConfig } from '@/features/import/domain/publish-mode';
import { resolvePublishPolicy } from '@/features/import/domain/publish-mode';
import type { ImportRecord } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import { matchingConfig } from '@/features/import/matching/matching-config';
import type {
  TrustPublishEvaluation,
  TrustQualityDecision,
  TrustQualityRuleRepository,
} from '@/features/trust-quality/domain/trust-quality-types';
import type { TrustPublishDecisionEngine } from '@/features/trust-quality/services/trust-publish-decision-engine';

export type PublishDecision = 'publish' | 'queue_for_review' | 'skip';

export interface PublishDecisionInput {
  source: SourceRecord;
  record: ImportRecord;
  policy?: PublishPolicyConfig;
}

function mapTrustDecisionToPublishDecision(decision: TrustQualityDecision): PublishDecision {
  switch (decision) {
    case 'auto_publish':
      return 'publish';
    case 'review_required':
    case 'hold':
      return 'queue_for_review';
    case 'reject':
    default:
      return 'skip';
  }
}

export class PublishDecisionService {
  constructor(
    private readonly trustEngine?: TrustPublishDecisionEngine,
    private readonly ruleRepository?: TrustQualityRuleRepository,
  ) {}

  async evaluate(input: PublishDecisionInput): Promise<TrustPublishEvaluation | null> {
    if (!this.trustEngine || !this.ruleRepository) {
      return null;
    }

    const policy = input.policy ?? resolvePublishPolicy(input.source);
    const rules = await this.ruleRepository.listEnabled();
    return this.trustEngine.evaluate({
      source: input.source,
      record: input.record,
      policy,
      rules,
    });
  }

  async decide(input: PublishDecisionInput): Promise<PublishDecision> {
    const trustEvaluation = await this.evaluate(input);
    if (trustEvaluation) {
      if (trustEvaluation.decision === 'reject') {
        return 'skip';
      }
      if (trustEvaluation.decision === 'auto_publish') {
        return 'publish';
      }
      return 'queue_for_review';
    }

    return this.decideLegacy(input);
  }

  shouldAutoPublishAfterImport(source: SourceRecord): boolean {
    const mode: PublishMode = source.publishMode ?? 'manual_review';
    return mode === 'auto_publish' || mode === 'conditional_review';
  }

  private decideLegacy(input: PublishDecisionInput): PublishDecision {
    const policy = input.policy ?? resolvePublishPolicy(input.source);
    const { record } = input;

    if (record.status === 'rejected' || record.status === 'imported' || record.status === 'duplicate') {
      return 'skip';
    }

    if ((record.validationErrors?.length ?? 0) > 0) {
      return 'skip';
    }

    if (this.hasUncertainElectronicRelevance(record)) {
      return 'queue_for_review';
    }

    if (policy.mode === 'manual_review') {
      return record.status === 'approved' ? 'publish' : 'queue_for_review';
    }

    if (
      policy.blockOnDuplicate &&
      record.duplicateScore !== undefined &&
      record.duplicateScore >= matchingConfig.duplicateThreshold &&
      record.duplicateDecision !== 'dismissed'
    ) {
      return policy.mode === 'auto_publish' ? 'queue_for_review' : 'skip';
    }

    if (policy.mode === 'auto_publish') {
      return record.status === 'approved' || record.status === 'needs_review' ? 'publish' : 'skip';
    }

    const trustScore = input.source.computedTrustScore ?? input.source.trustScore ?? 0;
    if (trustScore < (policy.minTrustScore ?? 0)) {
      return 'queue_for_review';
    }

    const payload = record.normalizedPayload as Record<string, unknown> | undefined;
    const metadata = payload?.sourceMetadata as Record<string, unknown> | undefined;
    const confidence = metadata?.extractionConfidence ?? payload?.extractionConfidence;
    if (
      typeof confidence === 'number' &&
      confidence < (policy.minExtractionConfidence ?? 0)
    ) {
      return 'queue_for_review';
    }

    return record.status === 'approved' || record.status === 'needs_review' ? 'publish' : 'skip';
  }

  private hasUncertainElectronicRelevance(record: ImportRecord): boolean {
    const payload = record.normalizedPayload as Record<string, unknown> | undefined;
    const rawMetadata = (record.rawPayload?.sourceMetadata ?? payload?.sourceMetadata) as
      | Record<string, unknown>
      | undefined;
    return rawMetadata?.electronicRelevance === 'uncertain';
  }

  mapTrustDecision(decision: TrustQualityDecision): PublishDecision {
    return mapTrustDecisionToPublishDecision(decision);
  }
}
