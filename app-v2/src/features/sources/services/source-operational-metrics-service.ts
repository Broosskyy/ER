import type { AdminSourceRepository } from '@/data/repositories/repositories';
import type { ImportJobRepository, ImportRecordRepository } from '@/data/repositories/import-repositories';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { AdminEventRepository } from '@/data/repositories/repositories';
import type { SourceRecord } from '@/data/types/records';
import type { ImportJob } from '@/features/import/models/types';
import {
  computeSourceOperationalMetrics,
  metricsChanged,
} from '@/features/sources/domain/source-operational-metrics';
import {
  applyImportReliabilitySnapshot,
  buildImportHealthSnapshot,
  eventsFromImportRecords,
} from '@/features/sources/domain/source-reliability-service';

export interface SourceMetricsFinalizeResult {
  source: SourceRecord;
  metrics: ReturnType<typeof computeSourceOperationalMetrics>;
  updated: boolean;
  skippedDuplicateFinalization: boolean;
}

export class SourceOperationalMetricsService {
  constructor(
    private readonly sourceRepository: AdminSourceRepository,
    private readonly recordRepository: ImportRecordRepository,
    private readonly jobRepository: ImportJobRepository,
    private readonly sourceReferences: EventSourceReferenceRepository,
    private readonly adminEventRepository: AdminEventRepository,
  ) {}

  async computeForSource(sourceId: string): Promise<ReturnType<typeof computeSourceOperationalMetrics>> {
    const [importRecords, importJobs, origins] = await Promise.all([
      this.recordRepository.listLatestBySourceId(sourceId),
      this.jobRepository.listBySourceId(sourceId),
      this.sourceReferences.findBySourceId(sourceId),
    ]);

    const eventIds = [
      ...new Set(
        origins
          .map((origin) => origin.canonicalEventId)
          .filter((eventId): eventId is string => Boolean(eventId)),
      ),
    ];
    const eventsById = new Map<string, Awaited<ReturnType<AdminEventRepository['getById']>>>();
    for (const eventId of eventIds) {
      const event = await this.adminEventRepository.getById(eventId);
      if (event) {
        eventsById.set(eventId, event);
      }
    }

    return computeSourceOperationalMetrics({
      importRecords,
      importJobs,
      origins,
      eventsById: eventsById as Map<string, NonNullable<Awaited<ReturnType<AdminEventRepository['getById']>>>>,
    });
  }

  async applyMetricsToSource(
    source: SourceRecord,
    metrics: ReturnType<typeof computeSourceOperationalMetrics>,
    job?: ImportJob,
    reliabilitySnapshot?: ReturnType<typeof buildImportHealthSnapshot>,
  ): Promise<SourceRecord> {
    let next = this.buildMetricsSourceUpdate(source, metrics, job);
    if (reliabilitySnapshot) {
      next = applyImportReliabilitySnapshot(next, reliabilitySnapshot);
    }
    return this.sourceRepository.save(next);
  }

  private buildMetricsSourceUpdate(
    source: SourceRecord,
    metrics: ReturnType<typeof computeSourceOperationalMetrics>,
    job?: ImportJob,
  ): SourceRecord {
    const now = new Date().toISOString();
    const next: SourceRecord = {
      ...source,
      totalImportCount: metrics.totalImportCount,
      totalValidEventCount: metrics.totalValidEventCount,
      totalRejectedEventCount: metrics.totalRejectedEventCount,
      consecutiveFailureCount: metrics.consecutiveFailureCount,
      updatedAt: now,
    };

    if (metrics.lastImportAt) {
      next.lastImportAt = metrics.lastImportAt;
    }
    if (metrics.lastJobStatus) {
      next.lastJobStatus = metrics.lastJobStatus;
    }
    if (metrics.lastFailedImportAt) {
      next.lastFailedImportAt = metrics.lastFailedImportAt;
    }
    if (metrics.lastJobStatus && ['completed', 'completed_with_warnings'].includes(metrics.lastJobStatus)) {
      next.lastSuccessfulSyncAt = metrics.lastImportAt;
    }

    if (job) {
      next.metadata = {
        ...(source.metadata ?? {}),
        lastFinalizedImportJobId: job.id,
        lastFinalizedImportJobAt: job.finishedAt ?? now,
      };
    }

    return next;
  }

  /**
   * Recomputes metrics from authoritative tables and persists them.
   * Idempotent: skips when the same job was already finalized for this source.
   */
  async finalizeImportJob(source: SourceRecord, job: ImportJob): Promise<SourceMetricsFinalizeResult> {
    const lastFinalizedJobId = source.metadata?.lastFinalizedImportJobId;
    if (typeof lastFinalizedJobId === 'string' && lastFinalizedJobId === job.id) {
      return {
        source,
        metrics: await this.computeForSource(source.id),
        updated: false,
        skippedDuplicateFinalization: true,
      };
    }

    const metrics = await this.computeForSource(source.id);
    const before = {
      totalImportCount: source.totalImportCount ?? 0,
      totalValidEventCount: source.totalValidEventCount ?? 0,
      totalRejectedEventCount: source.totalRejectedEventCount ?? 0,
      lastImportAt: source.lastImportAt,
      lastJobStatus: source.lastJobStatus,
      lastFailedImportAt: source.lastFailedImportAt,
      consecutiveFailureCount: source.consecutiveFailureCount ?? 0,
    };

    const jobRecords = await this.recordRepository.listByJobId(job.id);
    const coverageEvents = eventsFromImportRecords(jobRecords);
    const reliabilitySnapshot = buildImportHealthSnapshot({
      source,
      job,
      events: coverageEvents,
    });
    const saved = await this.applyMetricsToSource(source, metrics, job, reliabilitySnapshot);

    return {
      source: saved,
      metrics,
      updated: metricsChanged(before, metrics) || lastFinalizedJobId !== job.id,
      skippedDuplicateFinalization: false,
    };
  }

  /** Idempotent backfill for one or all sources. */
  async backfillSource(sourceId: string): Promise<SourceRecord> {
    const source = await this.sourceRepository.getById(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }
    const metrics = await this.computeForSource(sourceId);
    return this.applyMetricsToSource(source, metrics);
  }

  async backfillAll(sourceIds?: string[]): Promise<SourceRecord[]> {
    const sources = sourceIds
      ? (
          await Promise.all(sourceIds.map((id) => this.sourceRepository.getById(id)))
        ).filter((source): source is SourceRecord => Boolean(source))
      : await this.sourceRepository.getAll();

    const updated: SourceRecord[] = [];
    for (const source of sources) {
      updated.push(await this.backfillSource(source.id));
    }
    return updated;
  }
}
