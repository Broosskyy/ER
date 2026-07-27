import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext, PipelineStepResult } from '@/features/aggregation/pipeline/types';
import type { ImportAdapterRecordResult } from '@/features/import/adapters/types';
import type { ImportSource } from '@/features/import/models/types';

export interface FetchedImportPayload {
  externalId: string;
  sourceUrl?: string;
  rawPayload: Record<string, unknown>;
  adapterResult?: ImportAdapterRecordResult;
}

export interface FetchProvider {
  fetch(source: AggregationSource, importSource: ImportSource, context: PipelineRunContext): Promise<FetchedImportPayload[]>;
}

export class FetchStep {
  readonly stepName = 'fetch' as const;

  constructor(private readonly provider: FetchProvider) {}

  async execute(
    input: { importSource: ImportSource },
    context: PipelineRunContext,
  ): Promise<PipelineStepResult<FetchedImportPayload>> {
    const started = Date.now();
    const items = await this.provider.fetch(context.source, input.importSource, context);
    return {
      step: this.stepName,
      items,
      warnings: [],
      errors: [],
      durationMs: Date.now() - started,
    };
  }
}
