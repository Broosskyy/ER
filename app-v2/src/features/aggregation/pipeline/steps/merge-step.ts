import type { PipelineRunContext, PipelineStepResult } from '@/features/aggregation/pipeline/types';
import type { DuplicateCheckedPayload } from '@/features/aggregation/pipeline/steps/duplicate-check-step';
import type { MergeStrategy, MergedImportEvent } from '@/features/aggregation/merge/merge-strategy';

export interface MergedPipelinePayload {
  externalId: string;
  rawPayload: Record<string, unknown>;
  mergedEvent: MergedImportEvent;
  valid: boolean;
  validationErrors: DuplicateCheckedPayload['validationErrors'];
  validationWarnings: DuplicateCheckedPayload['validationWarnings'];
  duplicateEventId?: string;
  duplicateScore: number;
  isDuplicate: boolean;
}

export class MergeStep {
  readonly stepName = 'merge' as const;

  constructor(private readonly strategy: MergeStrategy) {}

  async execute(
    payloads: DuplicateCheckedPayload[],
    context: PipelineRunContext,
  ): Promise<PipelineStepResult<MergedPipelinePayload>> {
    const started = Date.now();
    const mergedGroups = new Map<string, MergedImportEvent>();
    const items: MergedPipelinePayload[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const retrievedAt = new Date().toISOString();

    for (const payload of payloads) {
      if (!payload.valid) {
        const passthrough = this.strategy.merge(payload.canonicalEvent, undefined, {
          sourcePriority: context.source.priority,
          sourceTrustScore: context.source.trustScore,
          retrievedAt,
        });
        items.push({
          externalId: payload.externalId,
          rawPayload: payload.rawPayload,
          mergedEvent: passthrough,
          valid: payload.valid,
          validationErrors: payload.validationErrors,
          validationWarnings: payload.validationWarnings,
          duplicateEventId: payload.duplicateEventId,
          duplicateScore: payload.duplicateScore,
          isDuplicate: payload.isDuplicate,
        });
        continue;
      }

      const existingGroups = [...mergedGroups.values()];
      const decision = this.strategy.decide(payload.canonicalEvent, existingGroups, {
        sourcePriority: context.source.priority,
        sourceTrustScore: context.source.trustScore,
        retrievedAt,
      });

      const existing = decision.mergeGroupId
        ? mergedGroups.get(decision.mergeGroupId)
        : undefined;

      const merged = this.strategy.merge(payload.canonicalEvent, existing, {
        sourcePriority: context.source.priority,
        sourceTrustScore: context.source.trustScore,
        retrievedAt,
      });

      if (decision.shouldMerge && decision.reason === 'lower_priority_contribution') {
        warnings.push(
          `Merged lower-priority contribution from ${payload.canonicalEvent.sourceName} into ${merged.mergeGroupId}.`,
        );
      }

      mergedGroups.set(merged.mergeGroupId, merged);

      items.push({
        externalId: payload.externalId,
        rawPayload: payload.rawPayload,
        mergedEvent: merged,
        valid: payload.valid,
        validationErrors: payload.validationErrors,
        validationWarnings: payload.validationWarnings,
        duplicateEventId: payload.duplicateEventId,
        duplicateScore: payload.duplicateScore,
        isDuplicate: payload.isDuplicate,
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
