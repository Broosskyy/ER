import type { SourceRecord } from '@/data/types/records';
import { canResolveSourceConnector } from '@/features/aggregation/connectors/source-connector-resolution';

export function shouldUseAggregationForSource(source: SourceRecord | null | undefined): boolean {
  return canResolveSourceConnector(source);
}
