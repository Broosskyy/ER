import { importConfig } from '@/features/import/config/import-config';
import type { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import {
  ImportAdapterError,
  ImportError,
  ImportExecutionError,
} from '@/features/import/errors/import-errors';
import type { ImportTriggerType } from '@/features/import/models/statuses';
import type { ImportJob } from '@/features/import/models/types';
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

export class ImportOrchestrator {
  constructor(
    private readonly sourceRepository: ImportSourceRepository,
    private readonly jobRepository: ImportJobRepository,
    private readonly recordRepository: ImportRecordRepository,
    private readonly adapterRegistry: ImportAdapterRegistry,
    private readonly loggingService: ImportLoggingService,
  ) {}

  async run(sourceId: string, triggerType: ImportTriggerType): Promise<ImportJob> {
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

      const fetchedRecords = await withTimeout(
        adapter.fetchRecords(source),
        importConfig.timeoutMs,
      );

      if (fetchedRecords.length > importConfig.maxRecordsPerJob) {
        throw new ImportExecutionError(
          `Adapter returned ${fetchedRecords.length} records, exceeding limit of ${importConfig.maxRecordsPerJob}.`,
          'IMPORT_RECORD_LIMIT_EXCEEDED',
        );
      }

      const savedRecords = await this.recordRepository.createMany(
        fetchedRecords.map((record) => ({
          importJobId: runningJob.id,
          sourceId: source.id,
          externalId: record.externalId,
          rawPayload: record.rawPayload,
          status: 'fetched' as const,
        })),
      );

      await this.loggingService.info(
        runningJob.id,
        'IMPORT_RECORDS_SAVED',
        `Saved ${savedRecords.length} import records.`,
      );

      return await this.jobRepository.update({
        ...runningJob,
        status: 'completed',
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Import execution failed.';
      await this.loggingService.error(runningJob.id, 'IMPORT_JOB_FAILED', message);

      return await this.jobRepository.update({
        ...runningJob,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
