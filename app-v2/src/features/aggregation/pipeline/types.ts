import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { AggregationPipelineStepName } from '@/features/aggregation/domain/import-pipeline-status';
import type { ImportTriggerType } from '@/features/import/models/statuses';

export interface PipelineRunContext {
  runId: string;
  source: AggregationSource;
  triggerType: ImportTriggerType;
  triggeredBy?: string;
  startedAt: string;
}

export interface PipelineStepResult<T> {
  step: AggregationPipelineStepName;
  items: T[];
  warnings: string[];
  errors: string[];
  durationMs: number;
}

export interface PipelineStep<Input, Output> {
  readonly stepName: AggregationPipelineStepName;
  execute(input: Input, context: PipelineRunContext): Promise<PipelineStepResult<Output>>;
}

export interface PipelineRunSummary {
  runId: string;
  sourceId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  eventCount: number;
  errorCount: number;
  warningCount: number;
  stepDurations: Partial<Record<AggregationPipelineStepName, number>>;
}

export interface PipelineRunResult {
  summary: PipelineRunSummary;
  records: PipelineRecordEnvelope[];
}

export interface PipelineRecordEnvelope {
  externalId: string;
  status: import('@/features/aggregation/domain/import-pipeline-status').AggregationPipelineStatus;
  rawPayload?: Record<string, unknown>;
  canonicalEvent?: import('@/features/aggregation/domain/canonical-import-event').CanonicalImportEvent;
  validationErrors?: import('@/features/import/validation/validation-codes').ValidationIssue[];
  validationWarnings?: import('@/features/import/validation/validation-codes').ValidationIssue[];
  duplicateEventId?: string;
  duplicateScore?: number;
  mergeGroupId?: string;
  sourceContributions?: import('@/features/aggregation/merge/merge-strategy').SourceContribution[];
}
