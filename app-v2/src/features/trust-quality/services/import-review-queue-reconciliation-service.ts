import type { ImportRecordRepository } from '@/data/repositories/import-repositories';
import type { ImportRecord } from '@/features/import/models/types';
import {
  IMPORT_REVIEW_RESOLUTION_REASONS,
  type ImportReviewQueueEntry,
  type ImportReviewQueueRepository,
} from '@/features/trust-quality/domain/trust-quality-types';

export interface ReviewQueueReconciliationResult {
  scanned: number;
  reconciled: number;
  preserved: number;
  entries: Array<{
    queueEntryId: string;
    importRecordId: string;
    action: 'reconciled' | 'preserved';
    reason: string;
  }>;
}

function isImportedWithEvent(record: ImportRecord | null | undefined): boolean {
  return record?.status === 'imported' && Boolean(record.resultingEventId);
}

function isGenuineNeedsReview(record: ImportRecord | null | undefined): boolean {
  if (!record) {
    return false;
  }
  return record.status === 'needs_review' && !record.resultingEventId;
}

export class ImportReviewQueueReconciliationService {
  constructor(
    private readonly reviewQueueRepository: ImportReviewQueueRepository,
    private readonly recordRepository: ImportRecordRepository,
  ) {}

  async reconcileStalePendingEntries(options: {
    sourceId?: string;
    resolvedBy?: string;
    limit?: number;
  } = {}): Promise<ReviewQueueReconciliationResult> {
    const limit = options.limit ?? 500;
    const resolvedBy = options.resolvedBy ?? 'system:review-queue-reconciliation';
    const pending = options.sourceId
      ? (await this.reviewQueueRepository.listBySourceId(options.sourceId, limit)).filter(
          (entry) => entry.status === 'pending' || entry.status === 'on_hold',
        )
      : await this.reviewQueueRepository.listPending(limit);

    const result: ReviewQueueReconciliationResult = {
      scanned: pending.length,
      reconciled: 0,
      preserved: 0,
      entries: [],
    };

    for (const entry of pending) {
      const record = await this.recordRepository.getById(entry.importRecordId);

      if (isGenuineNeedsReview(record)) {
        result.preserved += 1;
        result.entries.push({
          queueEntryId: entry.id,
          importRecordId: entry.importRecordId,
          action: 'preserved',
          reason: 'genuine_needs_review',
        });
        continue;
      }

      if (!isImportedWithEvent(record)) {
        result.preserved += 1;
        result.entries.push({
          queueEntryId: entry.id,
          importRecordId: entry.importRecordId,
          action: 'preserved',
          reason: `record_status_${record?.status ?? 'missing'}`,
        });
        continue;
      }

      await this.closeAsImportedPublished(entry, record!, resolvedBy);
      result.reconciled += 1;
      result.entries.push({
        queueEntryId: entry.id,
        importRecordId: entry.importRecordId,
        action: 'reconciled',
        reason: IMPORT_REVIEW_RESOLUTION_REASONS.importedRecordPublished,
      });
    }

    return result;
  }

  async reconcileTestArtifactEntries(input: {
    sourceId: string;
    resolvedBy?: string;
    resolutionReason?: string;
  }): Promise<ReviewQueueReconciliationResult> {
    const resolvedBy = input.resolvedBy ?? 'system:test-artifact-reconciliation';
    const resolutionReason =
      input.resolutionReason ?? IMPORT_REVIEW_RESOLUTION_REASONS.testArtifactResolved;
    const entries = await this.reviewQueueRepository.listBySourceId(input.sourceId, 500);
    const active = entries.filter((entry) => entry.status === 'pending' || entry.status === 'on_hold');

    const result: ReviewQueueReconciliationResult = {
      scanned: active.length,
      reconciled: 0,
      preserved: 0,
      entries: [],
    };

    for (const entry of active) {
      const now = new Date().toISOString();
      await this.reviewQueueRepository.upsert({
        ...entry,
        status: 'expired',
        decision: 'reject',
        metadata: {
          ...(entry.metadata ?? {}),
          resolutionReason,
          resolvedAt: now,
          resolvedBy,
          priorStatus: entry.status,
          priorDecision: entry.decision,
          testArtifactSourceId: input.sourceId,
        },
        updatedAt: now,
      });
      result.reconciled += 1;
      result.entries.push({
        queueEntryId: entry.id,
        importRecordId: entry.importRecordId,
        action: 'reconciled',
        reason: resolutionReason,
      });
    }

    return result;
  }

  private async closeAsImportedPublished(
    entry: ImportReviewQueueEntry,
    record: ImportRecord,
    resolvedBy: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.reviewQueueRepository.upsert({
      ...entry,
      status: 'expired',
      decision: 'auto_publish',
      metadata: {
        ...(entry.metadata ?? {}),
        resolutionReason: IMPORT_REVIEW_RESOLUTION_REASONS.importedRecordPublished,
        resolvedAt: now,
        resolvedBy,
        priorStatus: entry.status,
        priorDecision: entry.decision,
        resultingEventId: record.resultingEventId,
        importRecordStatus: record.status,
      },
      updatedAt: now,
    });
  }
}
