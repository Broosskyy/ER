import type { SourceConnectorCapabilities } from '@/features/aggregation/connectors/framework/capabilities';
import type {
  SourceConnectorRateLimitConfig,
  SourceConnectorRetryConfig,
} from '@/features/aggregation/connectors/framework/config';
import type { SourceConnectorHealthSnapshot } from '@/features/aggregation/connectors/framework/health';
import type { SourceConnectorMetrics } from '@/features/aggregation/connectors/framework/metrics';
import type { SourceConnectorVersionInfo } from '@/features/aggregation/connectors/framework/versioning';
import type { SourceConnectorKey } from '@/features/aggregation/connectors/types';

export interface SourceConnectorDescriptor {
  connectorKey: SourceConnectorKey;
  displayName: string;
  connectorType: string;
  dataFormat: string;
  authentication: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth' | 'optional';
  timeoutMs: number;
  version: SourceConnectorVersionInfo;
  capabilities: SourceConnectorCapabilities;
  retryConfig: SourceConnectorRetryConfig;
  rateLimitConfig: SourceConnectorRateLimitConfig;
  health: SourceConnectorHealthSnapshot;
  metrics: SourceConnectorMetrics;
  limitations: string[];
}

export interface SourceConnectorDefinition {
  connectorKey: SourceConnectorKey;
  displayName: string;
  connectorType: string;
  dataFormat: string;
  authentication: SourceConnectorDescriptor['authentication'];
  timeoutMs: number;
  version: SourceConnectorVersionInfo;
  capabilities: SourceConnectorCapabilities;
  retryConfig?: Partial<SourceConnectorRetryConfig>;
  rateLimitConfig?: Partial<SourceConnectorRateLimitConfig>;
  limitations: string[];
}
