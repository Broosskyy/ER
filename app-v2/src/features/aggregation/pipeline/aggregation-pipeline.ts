import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { AggregationLogService } from '@/features/aggregation/logging/aggregation-log-service';
import { DuplicateCheckStep } from '@/features/aggregation/pipeline/steps/duplicate-check-step';
import { FetchStep, type FetchProvider } from '@/features/aggregation/pipeline/steps/fetch-step';
import { MergeStep } from '@/features/aggregation/pipeline/steps/merge-step';
import { NormalizeStep } from '@/features/aggregation/pipeline/steps/normalize-step';
import { PublishStep } from '@/features/aggregation/pipeline/steps/publish-step';
import { ReviewStep } from '@/features/aggregation/pipeline/steps/review-step';
import { ValidateStep } from '@/features/aggregation/pipeline/steps/validate-step';
import type {
  PipelineRecordEnvelope,
  PipelineRunContext,
  PipelineRunResult,
} from '@/features/aggregation/pipeline/types';
import { scoreBasedDuplicateStrategy } from '@/features/aggregation/duplicate/duplicate-strategy';
import { priorityBasedMergeStrategy } from '@/features/aggregation/merge/merge-strategy';
import type { SourceRecord } from '@/data/types/records';
import type { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import type { ImportSource } from '@/features/import/models/types';
import type { ImportTriggerType } from '@/features/import/models/statuses';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { buildSourceMergeReliabilityContext } from '@/features/sources/domain/source-reliability-merge-context';

export interface AggregationPipelineDependencies {
  fetchProvider: FetchProvider;
  logService?: AggregationLogService;
}

export class AggregationPipeline {
  private readonly fetchStep: FetchStep;
  private readonly normalizeStep = new NormalizeStep();
  private readonly validateStep = new ValidateStep();
  private readonly duplicateCheckStep = new DuplicateCheckStep(scoreBasedDuplicateStrategy);
  private readonly mergeStep = new MergeStep(priorityBasedMergeStrategy);
  private readonly reviewStep = new ReviewStep();
  private readonly publishStep = new PublishStep();
  private readonly logService: AggregationLogService;

  constructor(dependencies: AggregationPipelineDependencies) {
    this.fetchStep = new FetchStep(dependencies.fetchProvider);
    this.logService = dependencies.logService ?? new AggregationLogService();
  }

  async run(
    sourceRecord: SourceRecord,
    importSource: ImportSource,
    triggerType: ImportTriggerType,
    triggeredBy?: string,
  ): Promise<PipelineRunResult> {
    const runId = `aggregation-${sourceRecord.id}-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const source = mapSourceRecordToAggregationSource(sourceRecord);

    const context: PipelineRunContext = {
      runId,
      source,
      triggerType,
      triggeredBy,
      startedAt,
      sourceReliability: buildSourceMergeReliabilityContext(sourceRecord),
    };

    const runLog = await this.logService.startRun({
      runId,
      sourceId: source.id,
      sourceName: source.name,
      triggerType,
    });

    const stepDurations: PipelineRunResult['summary']['stepDurations'] = {};
    let warningCount = 0;
    let errorCount = 0;

    try {
      const fetched = await this.fetchStep.execute({ importSource }, context);
      stepDurations.fetch = fetched.durationMs;
      warningCount += fetched.warnings.length;
      errorCount += fetched.errors.length;
      await this.logService.logStep(runId, source.id, 'fetch', fetched.durationMs, {
        events: fetched.items.length,
        warnings: fetched.warnings.length,
        errors: fetched.errors.length,
      });

      const normalized = await this.normalizeStep.execute(fetched.items, context);
      stepDurations.normalize = normalized.durationMs;
      warningCount += normalized.warnings.length;
      errorCount += normalized.errors.length;
      await this.logService.logStep(runId, source.id, 'normalize', normalized.durationMs, {
        events: normalized.items.length,
        warnings: normalized.warnings.length,
        errors: normalized.errors.length,
      });

      const validated = await this.validateStep.execute(normalized.items, context);
      stepDurations.validate = validated.durationMs;
      warningCount += validated.warnings.length;
      errorCount += validated.errors.length;
      await this.logService.logStep(runId, source.id, 'validate', validated.durationMs, {
        events: validated.items.length,
        warnings: validated.warnings.length,
        errors: validated.errors.length,
      });

      const duplicateChecked = await this.duplicateCheckStep.execute(validated.items, context);
      stepDurations.duplicate_check = duplicateChecked.durationMs;
      warningCount += duplicateChecked.warnings.length;
      errorCount += duplicateChecked.errors.length;
      await this.logService.logStep(runId, source.id, 'duplicate_check', duplicateChecked.durationMs, {
        events: duplicateChecked.items.length,
        warnings: duplicateChecked.warnings.length,
        errors: duplicateChecked.errors.length,
      });

      const merged = await this.mergeStep.execute(duplicateChecked.items, context);
      stepDurations.merge = merged.durationMs;
      warningCount += merged.warnings.length;
      errorCount += merged.errors.length;
      await this.logService.logStep(runId, source.id, 'merge', merged.durationMs, {
        events: merged.items.length,
        warnings: merged.warnings.length,
        errors: merged.errors.length,
      });

      const reviewed = await this.reviewStep.execute(merged.items, context);
      stepDurations.review = reviewed.durationMs;
      warningCount += reviewed.warnings.length;
      errorCount += reviewed.errors.length;
      await this.logService.logStep(runId, source.id, 'review', reviewed.durationMs, {
        events: reviewed.items.length,
        warnings: reviewed.warnings.length,
        errors: reviewed.errors.length,
      });

      const published = await this.publishStep.execute(reviewed.items, context);
      stepDurations.publish = published.durationMs;
      warningCount += published.warnings.length;
      errorCount += published.errors.length;
      await this.logService.logStep(runId, source.id, 'publish', published.durationMs, {
        events: published.items.length,
        warnings: published.warnings.length,
        errors: published.errors.length,
      });

      const records: PipelineRecordEnvelope[] = published.items.map((item) => ({
        externalId: item.externalId,
        status: item.pipelineStatus,
        rawPayload: item.rawPayload,
        canonicalEvent: item.mergedEvent.canonicalEvent,
        validationErrors: item.validationErrors,
        validationWarnings: item.validationWarnings,
        duplicateEventId: item.duplicateEventId,
        duplicateScore: item.duplicateScore,
        mergeGroupId: item.mergedEvent.mergeGroupId,
        sourceContributions: item.mergedEvent.sourceContributions,
      }));

      const finishedAt = new Date().toISOString();
      const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

      await this.logService.finishRun(runLog, {
        durationMs,
        eventCount: records.length,
        errorCount,
        warningCount,
        stepDurations,
      });

      return {
        summary: {
          runId,
          sourceId: source.id,
          startedAt,
          finishedAt,
          durationMs,
          eventCount: records.length,
          errorCount,
          warningCount,
          stepDurations,
        },
        records,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Aggregation pipeline failed.';
      await this.logService.logError(runId, source.id, message);
      throw error;
    }
  }
}

export function createAdapterFetchProvider(adapterRegistry: ImportAdapterRegistry): FetchProvider {
  return {
    async fetch(source, importSource, context) {
      if (!importSource.adapterKey) {
        throw new Error(`Source ${source.id} has no adapter key configured.`);
      }

      const adapter = adapterRegistry.get(importSource.adapterKey);
      const result = await adapter.execute(importSource, {
        jobId: context.runId,
        log: async () => undefined,
      });

      return result.records.map((record) => ({
        externalId: record.externalId,
        sourceUrl: record.sourceUrl,
        rawPayload: record.rawPayload,
        adapterResult: record,
      }));
    },
  };
}

export function createAggregationPipelineFromSource(
  sourceRecord: SourceRecord,
  adapterRegistry: ImportAdapterRegistry,
): {
  pipeline: AggregationPipeline;
  importSource: ImportSource;
} {
  return {
    pipeline: new AggregationPipeline({
      fetchProvider: createAdapterFetchProvider(adapterRegistry),
    }),
    importSource: mapSourceRecordToImportSource(sourceRecord),
  };
}
