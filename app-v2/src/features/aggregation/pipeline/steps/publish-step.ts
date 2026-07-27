import type { AggregationPipelineStatus } from '@/features/aggregation/domain/import-pipeline-status';
import type { PipelineRunContext, PipelineStepResult } from '@/features/aggregation/pipeline/types';
import type { ReviewQueuedPayload } from '@/features/aggregation/pipeline/steps/review-step';

export interface PublishedPipelinePayload extends ReviewQueuedPayload {
  pipelineStatus: AggregationPipelineStatus;
}

export class PublishStep {
  readonly stepName = 'publish' as const;

  async execute(
    payloads: ReviewQueuedPayload[],
    _context: PipelineRunContext,
  ): Promise<PipelineStepResult<PublishedPipelinePayload>> {
    const started = Date.now();
    const items: PublishedPipelinePayload[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const payload of payloads) {
      if (payload.pipelineStatus === 'approved' && payload.autoPublishPrepared) {
        warnings.push(
          `Auto-publish prepared for ${payload.externalId}; explicit publish action still required.`,
        );
      }

      items.push({
        ...payload,
        pipelineStatus:
          payload.pipelineStatus === 'approved' && payload.autoPublishPrepared
            ? payload.pipelineStatus
            : payload.pipelineStatus,
      });
    }

    return {
      step: this.stepName,
      items,
      warnings,
      errors,
      durationMs: Date.now() - started,
    };
  }
}
