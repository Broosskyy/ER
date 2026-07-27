import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { SourceRecord } from '@/data/types/records';
import type {
  ImportJobRepository,
  ImportRecordRepository,
  ImportSourceRepository,
} from '@/data/repositories/import-repositories';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { createSourceConnectorFetchProvider } from '@/features/aggregation/connectors/create-source-connector-fetch-provider';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { AggregationLogService } from '@/features/aggregation/logging/aggregation-log-service';
import { AggregationPipeline } from '@/features/aggregation/pipeline/aggregation-pipeline';
import { mapPipelineStatusToImportRecordStatus } from '@/features/aggregation/mappers/status-mapper';
import type { PipelineRecordEnvelope } from '@/features/aggregation/pipeline/types';
import { importUpdateService } from '@/features/aggregation/services/import-update-service';
import { importConfig } from '@/features/import/config/import-config';
import { ImportError } from '@/features/import/errors/import-errors';
import { loadMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { ImportMatchingService } from '@/features/import/matching/import-matching-service';
import type { ImportTriggerType } from '@/features/import/models/statuses';
import {
  createEmptyJobMetrics,
  type CreateImportRecordInput,
  type ImportJob,
} from '@/features/import/models/types';
import type { ImportLoggingService } from '@/features/import/services/import-logging-service';
import type { AdminEventRepository } from '@/data/repositories/repositories';

function toImportRecordInput(
  envelope: PipelineRecordEnvelope,
  jobId: string,
  source: SourceRecord,
  matchResult?: ReturnType<ImportMatchingService['match']>['result'],
  changeType?: 'created' | 'updated' | 'cancelled',
): CreateImportRecordInput {
  const candidate = envelope.canonicalEvent;
  return {
    importJobId: jobId,
    sourceId: source.id,
    externalId: envelope.externalId,
    sourceUrl: candidate?.sourceUrl ?? candidate?.originalLink,
    sourceType: source.sourceType,
    sourceName: source.displayName,
    originalUrl: candidate?.originalLink ?? candidate?.eventUrl,
    retrievedAt: new Date().toISOString(),
    rawPayload: envelope.rawPayload ?? {},
    normalizedPayload: candidate ? (candidate as unknown as Record<string, unknown>) : undefined,
    validationErrors: envelope.validationErrors,
    validationWarnings: envelope.validationWarnings,
    matchedCityId: matchResult?.matchedCityId,
    matchedVenueId: matchResult?.matchedVenueId,
    matchedOrganizerId: matchResult?.matchedOrganizerId,
    matchedArtistIds: matchResult?.matchedArtistIds,
    matchedGenreIds: matchResult?.matchedGenreIds,
    duplicateEventId: envelope.duplicateEventId ?? matchResult?.duplicateEventId,
    duplicateScore: envelope.duplicateScore ?? matchResult?.duplicateScore,
    matchingWarnings: matchResult?.warnings,
    status: mapPipelineStatusToImportRecordStatus(envelope.status),
    ...(changeType
      ? {
          normalizedPayload: {
            ...(candidate as unknown as Record<string, unknown>),
            changeType,
            mergeGroupId: envelope.mergeGroupId,
            sourceContributions: envelope.sourceContributions,
          },
        }
      : {}),
  };
}

export class ImportAggregationService {
  private readonly pipeline: AggregationPipeline;
  private readonly matchingService = new ImportMatchingService();

  constructor(
    private readonly sourceRepository: ImportSourceRepository,
    private readonly jobRepository: ImportJobRepository,
    private readonly recordRepository: ImportRecordRepository,
    private readonly loggingService: ImportLoggingService,
    private readonly adminEventRepository: AdminEventRepository,
    private readonly aggregationLogService = new AggregationLogService(),
    private readonly catalogLoader: typeof loadMatchingCatalog = loadMatchingCatalog,
  ) {
    this.pipeline = new AggregationPipeline({
      fetchProvider: createSourceConnectorFetchProvider(sourceConnectorRegistry),
      logService: this.aggregationLogService,
    });
  }

  async runFromSourceRecord(
    sourceRecord: SourceRecord,
    triggerType: ImportTriggerType,
    triggeredBy?: string,
  ): Promise<ImportJob> {
    const importSource = mapSourceRecordToImportSource(sourceRecord);
    if (!importSource.active) {
      throw new ImportError(`Source "${sourceRecord.id}" is inactive.`, 'IMPORT_SOURCE_INACTIVE');
    }

    const job = await this.jobRepository.create({
      sourceId: sourceRecord.id,
      triggerType,
      status: 'pending',
      triggeredBy,
    });

    await this.loggingService.info(job.id, 'AGGREGATION_IMPORT_START', `Aggregation import started for ${sourceRecord.displayName}.`);

    const runningJob = await this.jobRepository.update({
      ...job,
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      const result = await this.pipeline.run(sourceRecord, importSource, triggerType, triggeredBy);
      const catalog = await this.catalogLoader();
      const existingByExternalId = new Map(
        (await this.getLatestRecordsForSource(sourceRecord.id)).map((record) => [
          record.externalId,
          record,
        ]),
      );

      const recordInputs: CreateImportRecordInput[] = [];
      const metrics = createEmptyJobMetrics();
      metrics.fetchedCount = result.records.length;

      for (const envelope of result.records) {
        if (!envelope.canonicalEvent) {
          metrics.invalidCount += 1;
          continue;
        }

        const cancelled = Boolean(envelope.rawPayload?.cancelled);
        if (cancelled) {
          metrics.warningCount += 1;
        }
        const existingRecord = existingByExternalId.get(envelope.externalId);
        const existingEvent = existingRecord?.resultingEventId
          ? await this.adminEventRepository.getById(existingRecord.resultingEventId)
          : null;

        const changeSet = importUpdateService.detectChanges(
          envelope.canonicalEvent,
          existingEvent,
          { cancelled },
        );

        const match = this.matchingService.match(
          {
            externalId: envelope.externalId,
            title: envelope.canonicalEvent.title,
            description: envelope.canonicalEvent.description,
            startDate: envelope.canonicalEvent.startDate,
            endDate: envelope.canonicalEvent.endDate,
            venueName: envelope.canonicalEvent.venueName,
            cityName: envelope.canonicalEvent.cityName,
            countryCode: envelope.canonicalEvent.countryCode,
            latitude: envelope.canonicalEvent.latitude,
            longitude: envelope.canonicalEvent.longitude,
            artistNames: envelope.canonicalEvent.artistNames,
            genreNames: envelope.canonicalEvent.genreNames,
            ticketUrl: envelope.canonicalEvent.ticketUrl,
            eventUrl: envelope.canonicalEvent.eventUrl ?? envelope.canonicalEvent.originalLink,
            imageUrl: envelope.canonicalEvent.imageUrl,
            organizerName: envelope.canonicalEvent.organizerName,
            sourceId: envelope.canonicalEvent.sourceId,
            sourceName: envelope.canonicalEvent.sourceName,
            rawSourceType: envelope.canonicalEvent.rawSourceType,
          },
          catalog,
        );

        if (envelope.status === 'rejected' || envelope.status === 'duplicate') {
          if (envelope.status === 'duplicate') {
            metrics.duplicateCount += 1;
          } else {
            metrics.invalidCount += 1;
          }
        } else {
          metrics.parsedCount += 1;
        }

        if (changeSet.changeType === 'updated') {
          metrics.updatedCount += 1;
        } else if (changeSet.changeType === 'created') {
          metrics.createdCount += 1;
        }

        recordInputs.push(
          toImportRecordInput(
            envelope,
            runningJob.id,
            sourceRecord,
            match.result,
            changeSet.changeType === 'unchanged' ? undefined : changeSet.changeType,
          ),
        );
      }

      if (recordInputs.length > importConfig.maxRecordsPerJob) {
        throw new ImportError(
          `Import exceeded record limit of ${importConfig.maxRecordsPerJob}.`,
          'IMPORT_RECORD_LIMIT_EXCEEDED',
        );
      }

      await this.recordRepository.createMany(recordInputs);

      const currentExternalIds = result.records.map((record) => record.externalId);
      const previousExternalIds = [...existingByExternalId.keys()];
      const missingExternalIds = importUpdateService.findMissingExternalIds(
        previousExternalIds,
        currentExternalIds,
      );

      for (const externalId of missingExternalIds) {
        const existingRecord = existingByExternalId.get(externalId);
        if (!existingRecord?.resultingEventId) {
          continue;
        }
        const existingEvent = await this.adminEventRepository.getById(existingRecord.resultingEventId);
        if (!existingEvent || existingEvent.status === 'archived') {
          continue;
        }
        await this.adminEventRepository.save({
          ...existingEvent,
          status: 'archived',
          updatedAt: new Date().toISOString(),
        });
        metrics.warningCount += 1;
        await this.loggingService.warning(
          runningJob.id,
          'AGGREGATION_EVENT_ARCHIVED',
          `Archived missing source event ${externalId}.`,
        );
      }

      await this.loggingService.info(
        runningJob.id,
        'AGGREGATION_IMPORT_COMPLETE',
        `Aggregation import completed with ${recordInputs.length} records in ${result.summary.durationMs}ms.`,
      );

      const status =
        metrics.invalidCount > 0 || metrics.warningCount > 0 ? 'completed_with_warnings' : 'completed';

      return await this.jobRepository.update({
        ...runningJob,
        status,
        metrics,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Aggregation import failed.';
      await this.loggingService.error(runningJob.id, 'AGGREGATION_IMPORT_FAILED', message);
      return await this.jobRepository.update({
        ...runningJob,
        status: 'failed',
        errorSummary: message,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  private async getLatestRecordsForSource(sourceId: string) {
    const jobs = await this.jobRepository.listBySourceId(sourceId);
    const records: Awaited<ReturnType<ImportRecordRepository['listByJobId']>> = [];
    for (const job of jobs.slice(-5)) {
      records.push(...(await this.recordRepository.listByJobId(job.id)));
    }
    return records;
  }
}
