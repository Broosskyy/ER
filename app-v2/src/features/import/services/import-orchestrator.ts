import { importConfig } from '@/features/import/config/import-config';
import type { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import type { ImportAdapterRecordResult } from '@/features/import/adapters/types';
import {
  ImportAdapterError,
  ImportError,
  ImportExecutionError,
} from '@/features/import/errors/import-errors';
import { matchingConfig } from '@/features/import/matching/matching-config';
import { loadMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { ImportMatchingService } from '@/features/import/matching/import-matching-service';
import type { ImportTriggerType } from '@/features/import/models/statuses';
import { createEmptyJobMetrics, type ImportJob } from '@/features/import/models/types';
import type {
  ImportJobRepository,
  ImportRecordRepository,
  ImportSourceRepository,
} from '@/data/repositories/import-repositories';
import { ImportLoggingService } from './import-logging-service';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ImportExecutionError('Import job timed out.', 'IMPORT_TIMEOUT'));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function enrichRecordsWithMatching(
  records: ImportAdapterRecordResult[],
  matchingService: ImportMatchingService,
  catalog: Awaited<ReturnType<typeof loadMatchingCatalog>>,
): ImportAdapterRecordResult[] {
  return records.map((record) => {
    if (record.status !== 'needs_review' || !record.normalizedCandidate) {
      return record;
    }

    const { result, logs } = matchingService.match(record.normalizedCandidate, catalog);

    return {
      ...record,
      matchResult: result,
      validationWarnings: [
        ...(record.validationWarnings ?? []),
        ...result.warnings.map((warning) => ({
          code: 'MATCHING_WARNING',
          message: warning,
        })),
      ],
      status: 'needs_review',
      _matchLogs: logs,
    } as ImportAdapterRecordResult & { _matchLogs?: typeof logs };
  });
}

function computeMetrics(records: ImportAdapterRecordResult[]) {
  const metrics = createEmptyJobMetrics();
  metrics.fetchedCount = records.length;

  for (const record of records) {
    if (record.status === 'needs_review') {
      metrics.parsedCount += 1;
    }
    if (record.status === 'invalid') {
      metrics.invalidCount += 1;
    }
    if (record.validationWarnings && record.validationWarnings.length > 0) {
      metrics.warningCount += 1;
    }
    if (record.validationErrors && record.validationErrors.length > 0) {
      metrics.errorCount += 1;
    }
    if (
      record.matchResult &&
      record.matchResult.duplicateScore >= matchingConfig.duplicateThreshold
    ) {
      metrics.duplicateCount += 1;
    }
  }

  return metrics;
}

function resolveJobStatus(metrics: ReturnType<typeof computeMetrics>): ImportJob['status'] {
  if (metrics.invalidCount > 0 || metrics.warningCount > 0 || metrics.errorCount > 0) {
    return 'completed_with_warnings';
  }
  return 'completed';
}

export class ImportOrchestrator {
  constructor(
    private readonly sourceRepository: ImportSourceRepository,
    private readonly jobRepository: ImportJobRepository,
    private readonly recordRepository: ImportRecordRepository,
    private readonly adapterRegistry: ImportAdapterRegistry,
    private readonly loggingService: ImportLoggingService,
    private readonly matchingService: ImportMatchingService = new ImportMatchingService(),
    private readonly catalogLoader: typeof loadMatchingCatalog = loadMatchingCatalog,
  ) {}

  async run(
    sourceId: string,
    triggerType: ImportTriggerType,
    triggeredBy?: string,
  ): Promise<ImportJob> {
    const source = await this.sourceRepository.getById(sourceId);
    if (!source) {
      throw new ImportError(`Source "${sourceId}" was not found.`, 'IMPORT_SOURCE_NOT_FOUND');
    }
    if (!source.active) {
      throw new ImportError(`Source "${sourceId}" is inactive.`, 'IMPORT_SOURCE_INACTIVE');
    }
    if (!source.adapterKey) {
      throw new ImportAdapterError(
        `Source "${sourceId}" has no adapter key configured.`,
        'IMPORT_ADAPTER_INVALID',
      );
    }

    const adapter = this.adapterRegistry.get(source.adapterKey);

    const job = await this.jobRepository.create({
      sourceId: source.id,
      triggerType,
      status: 'pending',
      triggeredBy,
    });

    await this.loggingService.info(job.id, 'IMPORT_JOB_CREATED', `Import job created for source ${source.name}.`);

    const runningJob = await this.jobRepository.update({
      ...job,
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      await this.loggingService.info(
        runningJob.id,
        'IMPORT_ADAPTER_START',
        `Running adapter "${adapter.adapterKey}".`,
      );

      const adapterResult = await withTimeout(
        adapter.execute(source, {
          jobId: runningJob.id,
          log: async (level, code, message) => {
            await this.loggingService[level](runningJob.id, code, message);
          },
        }),
        importConfig.timeoutMs,
      );

      if (adapterResult.records.length > importConfig.maxRecordsPerJob) {
        throw new ImportExecutionError(
          `Adapter returned ${adapterResult.records.length} records, exceeding limit of ${importConfig.maxRecordsPerJob}.`,
          'IMPORT_RECORD_LIMIT_EXCEEDED',
        );
      }

      for (const warning of adapterResult.warnings) {
        await this.loggingService.warning(runningJob.id, 'IMPORT_ADAPTER_WARNING', warning);
      }

      const catalog = await this.catalogLoader();
      const matchedRecords = enrichRecordsWithMatching(
        adapterResult.records,
        this.matchingService,
        catalog,
      );

      for (const record of matchedRecords) {
        const matchLogs = (record as ImportAdapterRecordResult & { _matchLogs?: Array<{ level: string; code: string; message: string }> })._matchLogs;
        if (matchLogs) {
          for (const entry of matchLogs) {
            if (entry.level === 'warning') {
              await this.loggingService.warning(runningJob.id, entry.code, entry.message);
            } else {
              await this.loggingService.info(runningJob.id, entry.code, entry.message);
            }
          }
        }
      }

      await this.recordRepository.createMany(
        matchedRecords.map((record) => ({
          importJobId: runningJob.id,
          sourceId: source.id,
          externalId: record.externalId,
          sourceUrl: record.sourceUrl,
          rawPayload: record.rawPayload,
          normalizedPayload: record.normalizedCandidate
            ? (record.normalizedCandidate as unknown as Record<string, unknown>)
            : undefined,
          validationErrors: record.validationErrors,
          validationWarnings: record.validationWarnings,
          matchedCityId: record.matchResult?.matchedCityId,
          matchedVenueId: record.matchResult?.matchedVenueId,
          matchedOrganizerId: record.matchResult?.matchedOrganizerId,
          matchedArtistIds: record.matchResult?.matchedArtistIds,
          matchedGenreIds: record.matchResult?.matchedGenreIds,
          duplicateEventId: record.matchResult?.duplicateEventId,
          duplicateScore: record.matchResult?.duplicateScore,
          matchingWarnings: record.matchResult?.warnings,
          status: record.status,
        })),
      );

      const metrics = computeMetrics(matchedRecords);

      await this.loggingService.info(
        runningJob.id,
        'IMPORT_RECORDS_SAVED',
        `Saved ${matchedRecords.length} import records.`,
      );

      return await this.jobRepository.update({
        ...runningJob,
        status: resolveJobStatus(metrics),
        metrics,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Import execution failed.';
      await this.loggingService.error(runningJob.id, 'IMPORT_JOB_FAILED', message);

      return await this.jobRepository.update({
        ...runningJob,
        status: 'failed',
        errorSummary: message,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
