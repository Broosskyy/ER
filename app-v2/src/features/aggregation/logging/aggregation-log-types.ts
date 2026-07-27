import type { AggregationPipelineStepName } from '@/features/aggregation/domain/import-pipeline-status';
import type { ImportLogLevel } from '@/features/import/models/statuses';

export interface AggregationLogEntry {
  runId: string;
  sourceId: string;
  level: ImportLogLevel;
  code: string;
  message: string;
  timestamp?: string;
  step?: AggregationPipelineStepName;
  durationMs?: number;
  eventCount?: number;
  errorCount?: number;
  warningCount?: number;
}

export interface AggregationRunLog {
  runId: string;
  sourceId: string;
  sourceName: string;
  triggerType: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  eventCount: number;
  errorCount: number;
  warningCount: number;
  stepDurations: Partial<Record<AggregationPipelineStepName, number>>;
  entries: AggregationLogEntry[];
}
