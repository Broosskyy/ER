import type { PipelineRunContext, PipelineStepResult } from '@/features/aggregation/pipeline/types';
import type { ValidatedImportPayload } from '@/features/aggregation/pipeline/steps/validate-step';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { DuplicateStrategy } from '@/features/aggregation/duplicate/duplicate-strategy';
import { loadMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { matchingConfig } from '@/features/import/matching/matching-config';

export interface DuplicateCheckedPayload {
  externalId: string;
  rawPayload: Record<string, unknown>;
  canonicalEvent: CanonicalImportEvent;
  valid: boolean;
  validationErrors: ValidatedImportPayload['validationErrors'];
  validationWarnings: ValidatedImportPayload['validationWarnings'];
  duplicateEventId?: string;
  duplicateScore: number;
  isDuplicate: boolean;
}

export class DuplicateCheckStep {
  readonly stepName = 'duplicate_check' as const;

  constructor(
    private readonly strategy: DuplicateStrategy,
    private readonly catalogLoader: typeof loadMatchingCatalog = loadMatchingCatalog,
  ) {}

  async execute(
    payloads: ValidatedImportPayload[],
    _context: PipelineRunContext,
  ): Promise<PipelineStepResult<DuplicateCheckedPayload>> {
    const started = Date.now();
    const catalog = await this.catalogLoader();
    const items: DuplicateCheckedPayload[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const payload of payloads) {
      if (!payload.valid) {
        items.push({
          ...payload,
          duplicateScore: 0,
          isDuplicate: false,
        });
        continue;
      }

      const duplicate = this.strategy.compare(payload.canonicalEvent, catalog);
      if (duplicate.warning) {
        warnings.push(duplicate.warning);
      }

      items.push({
        ...payload,
        duplicateEventId: duplicate.duplicateEventId,
        duplicateScore: duplicate.duplicateScore,
        isDuplicate: duplicate.duplicateScore >= matchingConfig.duplicateThreshold,
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
