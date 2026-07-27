export const AGGREGATION_PIPELINE_STATUSES = [
  'discovered',
  'imported',
  'normalized',
  'validated',
  'duplicate',
  'pending_review',
  'approved',
  'published',
  'rejected',
  'archived',
] as const;

export type AggregationPipelineStatus = (typeof AGGREGATION_PIPELINE_STATUSES)[number];

export const AGGREGATION_PIPELINE_STEP_NAMES = [
  'fetch',
  'normalize',
  'validate',
  'duplicate_check',
  'merge',
  'review',
  'publish',
] as const;

export type AggregationPipelineStepName = (typeof AGGREGATION_PIPELINE_STEP_NAMES)[number];

export function isAggregationPipelineStatus(value: string): value is AggregationPipelineStatus {
  return (AGGREGATION_PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function isAggregationPipelineStepName(value: string): value is AggregationPipelineStepName {
  return (AGGREGATION_PIPELINE_STEP_NAMES as readonly string[]).includes(value);
}
