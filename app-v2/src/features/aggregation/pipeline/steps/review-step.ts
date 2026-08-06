import type { AggregationPipelineStatus } from '@/features/aggregation/domain/import-pipeline-status';
import type { PipelineRunContext, PipelineStepResult } from '@/features/aggregation/pipeline/types';
import type { MergedPipelinePayload } from '@/features/aggregation/pipeline/steps/merge-step';

export interface ReviewQueuedPayload extends MergedPipelinePayload {
  pipelineStatus: AggregationPipelineStatus;
  autoPublishPrepared: boolean;
}

export class ReviewStep {
  readonly stepName = 'review' as const;

  async execute(
    payloads: MergedPipelinePayload[],
    context: PipelineRunContext,
  ): Promise<PipelineStepResult<ReviewQueuedPayload>> {
    const started = Date.now();
    const items: ReviewQueuedPayload[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const payload of payloads) {
      let pipelineStatus: AggregationPipelineStatus;

      if (!payload.valid) {
        pipelineStatus = 'rejected';
        errors.push(`Record ${payload.externalId} rejected during validation.`);
      } else if (payload.isDuplicate) {
        pipelineStatus = 'duplicate';
        warnings.push(`Record ${payload.externalId} flagged as duplicate.`);
      } else if (payload.mergedEvent.canonicalEvent.sourceMetadata?.electronicRelevance === 'irrelevant') {
        pipelineStatus = 'rejected';
        warnings.push(`Record ${payload.externalId} is outside electronic-music scope.`);
      } else if (payload.mergedEvent.canonicalEvent.sourceMetadata?.electronicRelevance === 'uncertain') {
        pipelineStatus = 'pending_review';
        warnings.push(`Record ${payload.externalId} has uncertain electronic relevance — queued for review.`);
      } else if (context.source.reviewRequired) {
        pipelineStatus = 'pending_review';
      } else {
        pipelineStatus = 'approved';
        warnings.push(`Auto-approval prepared for ${payload.externalId} (publish still separate).`);
      }

      items.push({
        ...payload,
        pipelineStatus,
        autoPublishPrepared: !context.source.reviewRequired,
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
