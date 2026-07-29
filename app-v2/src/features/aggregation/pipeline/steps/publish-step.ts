import type { AggregationPipelineStatus } from '@/features/aggregation/domain/import-pipeline-status';
import type { PipelineRunContext, PipelineStepResult } from '@/features/aggregation/pipeline/types';
import type { ReviewQueuedPayload } from '@/features/aggregation/pipeline/steps/review-step';

export interface PublishedPipelinePayload extends ReviewQueuedPayload {
  pipelineStatus: AggregationPipelineStatus;
  publishEligible: boolean;
}

/**
 * Marks records as publish-eligible after review.
 * Actual persistence to public.events is handled by ImportPublishOrchestratorService
 * (auto-publish) or ImportReviewService.approveRecord() (manual review).
 */
export class PublishStep {
  readonly stepName = 'publish' as const;

  async execute(
    payloads: ReviewQueuedPayload[],
    context: PipelineRunContext,
  ): Promise<PipelineStepResult<PublishedPipelinePayload>> {
    const started = Date.now();
    const items: PublishedPipelinePayload[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const payload of payloads) {
      const publishEligible =
        payload.valid &&
        !payload.isDuplicate &&
        (payload.pipelineStatus === 'approved' ||
          (payload.autoPublishPrepared && context.source.reviewRequired === false));

      if (publishEligible) {
        warnings.push(
          `Record ${payload.externalId} is publish-eligible; persistence handled by publish orchestrator.`,
        );
      }

      items.push({
        ...payload,
        publishEligible,
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
