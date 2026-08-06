import { calculateConnectorQualityScore } from '@/features/aggregation/connectors/framework/detail-extraction';
import type { SourceRecord } from '@/data/types/records';
import { mapSourceRecordToRegistryEntry } from '@/features/sources/domain/source-registry';
import { sourceHealthResolver } from '@/features/sources/domain/source-health-resolver';
import {
  resolveSourceCapabilityDeclaration,
  type SourceCapabilityDeclaration,
} from '@/features/sources/domain/source-capability-declaration';

export interface SourceMergeReliabilityContext {
  declaration: SourceCapabilityDeclaration;
  sourceHealthScore: number;
  sourceQualityScore: number;
}

export function buildSourceMergeReliabilityContext(
  source: SourceRecord,
): SourceMergeReliabilityContext {
  const declaration = resolveSourceCapabilityDeclaration(source);
  const registryEntry = mapSourceRecordToRegistryEntry(source);
  const health = sourceHealthResolver.resolve(registryEntry);
  const quality = calculateConnectorQualityScore({ source: registryEntry, health });

  return {
    declaration,
    sourceHealthScore: health.score,
    sourceQualityScore: quality.score,
  };
}
