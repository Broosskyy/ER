import type { AdminSourceRepository } from '@/data/repositories/repositories';
import type { SourceRecord } from '@/data/types/records';
import type { TrustQualityDecision } from '../domain/trust-quality-types';
import type {
  SourceReputationEventType,
  SourceReputationRepository,
} from '../domain/trust-quality-types';
import { SourceTrustEngine } from './source-trust-engine';
import {
  decideImportRunReputation,
  type ImportRunReputationSummary,
} from './import-run-reputation';

function createReputationEventId(): string {
  return `rep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function mapDecisionToReputationEvent(decision: TrustQualityDecision): SourceReputationEventType {
  switch (decision) {
    case 'auto_publish':
      return 'publish_success';
    case 'reject':
      return 'publish_rejected';
    case 'hold':
    case 'review_required':
      return 'publish_queued';
    default:
      return 'publish_queued';
  }
}

export class SourceReputationService {
  constructor(
    private readonly sourceRepository: AdminSourceRepository,
    private readonly reputationRepository: SourceReputationRepository,
    private readonly trustEngine: SourceTrustEngine,
  ) {}

  async recordPublishDecision(
    source: SourceRecord,
    decision: TrustQualityDecision,
    metadata: Record<string, unknown> = {},
  ): Promise<SourceRecord> {
    const eventType = mapDecisionToReputationEvent(decision);
    return this.applyTrustDelta(source, eventType, metadata);
  }

  async recordImportOutcome(
    source: SourceRecord,
    success: boolean,
    metadata: Record<string, unknown> = {},
  ): Promise<SourceRecord> {
    return this.applyTrustDelta(source, success ? 'import_success' : 'import_failure', metadata);
  }

  async recordImportRunOutcome(
    source: SourceRecord,
    summary: ImportRunReputationSummary,
  ): Promise<SourceRecord> {
    const history = await this.reputationRepository.listBySourceId(source.id, 200);
    const alreadyRecorded = history.some(
      (entry) => entry.metadata?.importJobId === summary.importJobId,
    );
    if (alreadyRecorded) {
      return source;
    }

    const decision = decideImportRunReputation(summary);
    if (!decision.eventType) {
      return source;
    }

    return this.applyTrustDelta(source, decision.eventType, decision.metadata);
  }

  async listHistory(sourceId: string, limit = 50) {
    return this.reputationRepository.listBySourceId(sourceId, limit);
  }

  private async applyTrustDelta(
    source: SourceRecord,
    eventType: SourceReputationEventType,
    metadata: Record<string, unknown>,
  ): Promise<SourceRecord> {
    const previousTrustScore = source.computedTrustScore ?? source.trustScore;
    const newTrustScore = this.trustEngine.applyReputationDelta(previousTrustScore, eventType);
    const now = new Date().toISOString();

    await this.reputationRepository.create({
      id: createReputationEventId(),
      sourceId: source.id,
      eventType,
      delta: newTrustScore - previousTrustScore,
      previousTrustScore,
      newTrustScore,
      metadata,
      createdAt: now,
    });

    return this.sourceRepository.save({
      ...source,
      computedTrustScore: newTrustScore,
      trustScoreUpdatedAt: now,
      updatedAt: now,
    });
  }
}
