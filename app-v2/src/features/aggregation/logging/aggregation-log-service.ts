import type { AggregationPipelineStepName } from '@/features/aggregation/domain/import-pipeline-status';
import type { AggregationLogEntry, AggregationRunLog } from '@/features/aggregation/logging/aggregation-log-types';
import type { ImportLoggingService } from '@/features/import/services/import-logging-service';

export class AggregationLogService {
  private readonly entries: AggregationLogEntry[] = [];

  constructor(private readonly importLoggingService?: ImportLoggingService) {}

  async startRun(input: {
    runId: string;
    sourceId: string;
    sourceName: string;
    triggerType: string;
  }): Promise<AggregationRunLog> {
    const entry: AggregationRunLog = {
      runId: input.runId,
      sourceId: input.sourceId,
      sourceName: input.sourceName,
      triggerType: input.triggerType,
      startedAt: new Date().toISOString(),
      eventCount: 0,
      errorCount: 0,
      warningCount: 0,
      stepDurations: {},
      entries: [],
    };

    await this.log({
      runId: input.runId,
      sourceId: input.sourceId,
      level: 'info',
      code: 'AGGREGATION_RUN_START',
      message: `Aggregation run started for source ${input.sourceName}.`,
    });

    return entry;
  }

  async logStep(
    runId: string,
    sourceId: string,
    step: AggregationPipelineStepName,
    durationMs: number,
    counts: { events: number; warnings: number; errors: number },
  ): Promise<void> {
    await this.log({
      runId,
      sourceId,
      level: counts.errors > 0 ? 'warning' : 'info',
      code: `AGGREGATION_STEP_${step.toUpperCase()}`,
      message: `Step ${step} finished in ${durationMs}ms (${counts.events} events, ${counts.errors} errors, ${counts.warnings} warnings).`,
      step,
      durationMs,
      eventCount: counts.events,
      errorCount: counts.errors,
      warningCount: counts.warnings,
    });
  }

  async finishRun(
    run: AggregationRunLog,
    summary: {
      durationMs: number;
      eventCount: number;
      errorCount: number;
      warningCount: number;
      stepDurations: Partial<Record<AggregationPipelineStepName, number>>;
    },
  ): Promise<AggregationRunLog> {
    const finished: AggregationRunLog = {
      ...run,
      finishedAt: new Date().toISOString(),
      durationMs: summary.durationMs,
      eventCount: summary.eventCount,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      stepDurations: summary.stepDurations,
      entries: [...this.entries.filter((entry) => entry.runId === run.runId)],
    };

    await this.log({
      runId: run.runId,
      sourceId: run.sourceId,
      level: summary.errorCount > 0 ? 'warning' : 'info',
      code: 'AGGREGATION_RUN_FINISH',
      message: `Aggregation run finished in ${summary.durationMs}ms with ${summary.eventCount} events.`,
      durationMs: summary.durationMs,
      eventCount: summary.eventCount,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
    });

  if (this.importLoggingService) {
      await this.importLoggingService.info(
        run.runId,
        'AGGREGATION_RUN_FINISH',
        `Aggregation run finished with ${summary.eventCount} events.`,
      );
    }

    return finished;
  }

  async logError(runId: string, sourceId: string, message: string): Promise<void> {
    await this.log({
      runId,
      sourceId,
      level: 'error',
      code: 'AGGREGATION_RUN_ERROR',
      message,
    });
  }

  listEntries(runId?: string): AggregationLogEntry[] {
    if (!runId) {
      return [...this.entries];
    }
    return this.entries.filter((entry) => entry.runId === runId);
  }

  private async log(entry: AggregationLogEntry): Promise<void> {
    this.entries.push({
      ...entry,
      timestamp: entry.timestamp ?? new Date().toISOString(),
    });

    if (this.importLoggingService && entry.level !== 'debug') {
      await this.importLoggingService[entry.level](
        entry.runId,
        entry.code,
        entry.message,
      );
    }
  }
}
