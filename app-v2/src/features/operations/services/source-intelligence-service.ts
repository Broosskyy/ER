import type { AdminSourceRepository } from '@/data/repositories/repositories';
import type { SourceRecord } from '@/data/types/records';
import type { EventLifecycleHistoryRepository } from '@/features/event-lifecycle/domain/lifecycle-engine-types';
import type { ImportJobQueueRepository } from '@/features/import/scheduling/import-schedule-types';
import type { ImportScheduleRepository } from '@/features/import/scheduling/import-schedule-types';
import type { EventMatchEvaluationRepository } from '@/features/multi-source-matching/domain/matching-types';
import type { ImportReviewQueueRepository } from '@/features/trust-quality/domain/trust-quality-types';
import type {
  SourceIntelligenceSnapshot,
  SourceIntelligenceSnapshotRepository,
} from '../domain/operations-types';

function createSnapshotId(sourceId: string): string {
  return `intel-${sourceId}-${Date.now()}`;
}

export class SourceIntelligenceService {
  constructor(
    private readonly sourceRepository: AdminSourceRepository,
    private readonly snapshotRepository: SourceIntelligenceSnapshotRepository,
    private readonly scheduleRepository: ImportScheduleRepository,
    private readonly queueRepository: ImportJobQueueRepository,
    private readonly reviewQueueRepository: ImportReviewQueueRepository,
    private readonly matchEvaluationRepository: EventMatchEvaluationRepository,
    private readonly lifecycleHistoryRepository: EventLifecycleHistoryRepository,
  ) {}

  async computeForSource(sourceId: string, now = new Date()): Promise<SourceIntelligenceSnapshot> {
    const source = await this.sourceRepository.getById(sourceId);
    if (!source) {
      throw new Error(`Source ${sourceId} not found.`);
    }

    const [scheduleState, queueEntries, reviews, matchEvals, lifecycleHistory] = await Promise.all([
      this.scheduleRepository.getState(sourceId),
      this.queueRepository.listBySourceId(sourceId, 50),
      this.reviewQueueRepository.listBySourceId(sourceId, 100),
      this.matchEvaluationRepository.listBySourceId(sourceId, 100),
      this.lifecycleHistoryRepository.listBySourceId(sourceId, 100),
    ]);

    const snapshot = this.buildSnapshot(source, scheduleState, queueEntries, reviews, matchEvals, lifecycleHistory, now);
    return this.snapshotRepository.upsert(snapshot);
  }

  async computeForAllSources(limit = 100): Promise<SourceIntelligenceSnapshot[]> {
    const { items } = await this.sourceRepository.list({ page: 1, pageSize: limit });
    const snapshots: SourceIntelligenceSnapshot[] = [];
    for (const source of items) {
      snapshots.push(await this.computeForSource(source.id));
    }
    return snapshots;
  }

  async getLatest(sourceId: string): Promise<SourceIntelligenceSnapshot | null> {
    return this.snapshotRepository.getLatestBySourceId(sourceId);
  }

  async listRecent(limit = 50): Promise<SourceIntelligenceSnapshot[]> {
    return this.snapshotRepository.listRecent(limit);
  }

  private buildSnapshot(
    source: SourceRecord,
    scheduleState: Awaited<ReturnType<ImportScheduleRepository['getState']>>,
    queueEntries: Awaited<ReturnType<ImportJobQueueRepository['listBySourceId']>>,
    reviews: Awaited<ReturnType<ImportReviewQueueRepository['listBySourceId']>>,
    matchEvals: Awaited<ReturnType<EventMatchEvaluationRepository['listBySourceId']>>,
    lifecycleHistory: Awaited<ReturnType<EventLifecycleHistoryRepository['listBySourceId']>>,
    now: Date,
  ): SourceIntelligenceSnapshot {
    const totalImports = source.totalImportCount ?? 0;
    const errorRate = Math.min(100, Math.max(0, (source.errorRate ?? 0) * 100));
    const successRate = totalImports > 0 ? Math.max(0, 100 - errorRate) : 0;
    const queueDepth = queueEntries.filter((entry) => entry.status === 'queued').length;
    const pendingReviewCount = reviews.filter(
      (entry) => entry.status === 'pending' || entry.status === 'on_hold',
    ).length;

    const consecutiveFailures = scheduleState?.consecutiveFailures ?? 0;
    const inBackoff = scheduleState?.backoffUntil
      ? new Date(scheduleState.backoffUntil).getTime() > now.getTime()
      : false;

    let availabilityScore = 100;
    if (!source.enabled || source.archived) availabilityScore -= 50;
    if (source.schedulerMaintenanceMode) availabilityScore -= 20;
    if (inBackoff) availabilityScore -= 15;
    if (consecutiveFailures > 0) availabilityScore -= Math.min(30, consecutiveFailures * 5);
    availabilityScore = Math.max(0, availabilityScore);

    const schedulerLoadScore = Math.min(100, queueDepth * 10);

    return {
      id: createSnapshotId(source.id),
      sourceId: source.id,
      availabilityScore,
      successRate,
      avgImportDurationMs: source.averageDurationMs,
      errorRate,
      lastSuccessfulSyncAt: scheduleState?.lastSuccessfulImportAt ?? source.lastSuccessfulSyncAt,
      lastErrorAt: scheduleState?.lastFailedImportAt ?? source.lastFailedImportAt,
      lastErrorSummary: scheduleState?.lastSchedulerError ?? source.lastError,
      queueDepth,
      schedulerLoadScore,
      pendingReviewCount,
      matchEvaluationCount: matchEvals.length,
      lifecycleChangeCount: lifecycleHistory.reduce((sum, entry) => sum + entry.changeCount, 0),
      metadata: {
        sourceName: source.displayName,
        consecutiveFailures,
        inBackoff,
      },
      computedAt: now.toISOString(),
    };
  }
}
