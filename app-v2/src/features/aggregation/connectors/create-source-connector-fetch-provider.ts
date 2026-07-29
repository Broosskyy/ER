import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import {
  sourceConnectorRegistry,
  type SourceConnectorRegistry,
} from '@/features/aggregation/connectors/source-connector-registry';
import { resolveSourceConnectorKeyFromRecord } from '@/features/aggregation/connectors/source-connector-resolution';
import { rawEventToFetchedPayload, type SourceConnectorKey } from '@/features/aggregation/connectors/types';
import type { FetchProvider } from '@/features/aggregation/pipeline/steps/fetch-step';
import type { ImportSource } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';

export function createSourceConnectorFetchProvider(
  registry: SourceConnectorRegistry,
  resolveConnectorKey?: (source: ImportSource) => SourceConnectorKey,
): FetchProvider {
  const executor = registry.getExecutor();

  return {
    async fetch(source, importSource, context) {
      const connectorKey =
        resolveConnectorKey?.(importSource) ??
        registry.resolveConnectorKey({
          connectorKey: importSource.sourceConfig?.reference?.connectorKey,
          parserType: source.parserType,
          sourceType: source.type,
          adapterKey: importSource.adapterKey,
          sourceRoles: importSource.sourceRoles,
        });

      const connector = registry.get(connectorKey);
      const result = await executor.execute(connector, source, importSource, context);
      return result.events.map(rawEventToFetchedPayload);
    },
  };
}

export function resolveConnectorKeyFromSourceRecord(record: SourceRecord): SourceConnectorKey {
  return resolveSourceConnectorKeyFromRecord(record);
}

export function createAggregationSourceContext(record: SourceRecord) {
  return mapSourceRecordToAggregationSource(record);
}
