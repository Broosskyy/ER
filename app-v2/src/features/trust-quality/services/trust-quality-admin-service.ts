import type { AdminSourceRepository } from '@/data/repositories/repositories';
import type { SourceRecord } from '@/data/types/records';
import type {
  ImportReviewQueueRepository,
  SourceReputationRepository,
  TrustQualityRuleRepository,
} from '../domain/trust-quality-types';
import { SourceTrustEngine } from './source-trust-engine';
import { ImportReviewQueueService } from './import-review-queue-service';
import { SourceReputationService } from './source-reputation-service';

export interface SourceTrustQualityStatus {
  sourceId: string;
  trustScore: number;
  computedTrustScore?: number;
  trustScoreUpdatedAt?: string;
  qualityTier?: string;
  pendingReviews: number;
  onHoldReviews: number;
  recentReputationEvents: number;
}

export class TrustQualityAdminService {
  constructor(
    private readonly sourceRepository: AdminSourceRepository,
    private readonly ruleRepository: TrustQualityRuleRepository,
    private readonly reviewQueue: ImportReviewQueueService,
    private readonly reputationService: SourceReputationService,
    private readonly trustEngine: SourceTrustEngine,
    private readonly reputationRepository: SourceReputationRepository,
  ) {}

  async getSourceStatus(sourceId: string): Promise<SourceTrustQualityStatus | null> {
    const source = await this.sourceRepository.getById(sourceId);
    if (!source) {
      return null;
    }

    const reviews = await this.reviewQueue.listBySource(sourceId, 200);
    const reputation = await this.reputationRepository.listBySourceId(sourceId, 20);
    const effective = this.trustEngine.getEffectiveTrust(source);

    return {
      sourceId,
      trustScore: effective.trustScore,
      computedTrustScore: source.computedTrustScore,
      trustScoreUpdatedAt: source.trustScoreUpdatedAt,
      pendingReviews: reviews.filter((entry) => entry.status === 'pending').length,
      onHoldReviews: reviews.filter((entry) => entry.status === 'on_hold').length,
      recentReputationEvents: reputation.length,
    };
  }

  async listRules() {
    return this.ruleRepository.listAll();
  }

  async listPendingReviews(limit = 100) {
    return this.reviewQueue.listPending(limit);
  }

  async listReputationHistory(sourceId: string, limit = 50) {
    return this.reputationService.listHistory(sourceId, limit);
  }
}
