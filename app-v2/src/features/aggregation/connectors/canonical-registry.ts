/**
 * Canonical production runtime registry for source connectors.
 * See docs/real-data/SOURCE_CONNECTOR_REGISTRY.md
 */
export {
  SourceConnectorRegistry,
  createDefaultSourceConnectorRegistry,
  sourceConnectorRegistry,
} from '@/features/aggregation/connectors/source-connector-registry';

export {
  resolveSourceConnectorKey,
  resolveSourceConnectorKeyFromRecord,
  canResolveSourceConnector,
} from '@/features/aggregation/connectors/source-connector-resolution';

export { SOURCE_CONNECTOR_KEYS, type SourceConnectorKey } from '@/features/aggregation/connectors/types';

export { SOURCE_CONNECTOR_DEFINITIONS } from '@/features/aggregation/connectors/framework/connector-definitions';
