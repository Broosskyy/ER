import type { SourceConnectorCapabilities } from '@/features/aggregation/connectors/framework/capabilities';
import {
  resolveRateLimitConfig,
  resolveRetryConfig,
  type SourceConnectorFrameworkOverrides,
  type SourceConnectorRateLimitConfig,
  type SourceConnectorRetryConfig,
} from '@/features/aggregation/connectors/framework/config';
import type { SourceConnectorDefinition } from '@/features/aggregation/connectors/framework/descriptor';
import type { SourceConnectorVersionInfo } from '@/features/aggregation/connectors/framework/versioning';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent, SourceConnector, SourceConnectorKey } from '@/features/aggregation/connectors/types';

export interface RegisteredSourceConnector extends SourceConnector {
  readonly displayName: string;
  describeCapabilities(): SourceConnectorCapabilities;
  describeVersion(): SourceConnectorVersionInfo;
  getRetryConfig(importSource?: ImportSource): SourceConnectorRetryConfig;
  getRateLimitConfig(importSource?: ImportSource): SourceConnectorRateLimitConfig;
  getDefinition(): SourceConnectorDefinition;
}

function readFrameworkOverrides(importSource?: ImportSource): SourceConnectorFrameworkOverrides | undefined {
  const framework = importSource?.sourceConfig?.connectorFramework;
  if (!framework) {
    return undefined;
  }
  return {
    retry: framework.retry,
    rateLimit: framework.rateLimit,
  };
}

export abstract class BaseSourceConnector implements RegisteredSourceConnector {
  abstract readonly connectorKey: SourceConnectorKey;
  protected abstract readonly definition: SourceConnectorDefinition;

  get displayName(): string {
    return this.definition.displayName;
  }

  describeCapabilities(): SourceConnectorCapabilities {
    return this.definition.capabilities;
  }

  describeVersion(): SourceConnectorVersionInfo {
    return this.definition.version;
  }

  getDefinition(): SourceConnectorDefinition {
    return this.definition;
  }

  getRetryConfig(importSource?: ImportSource): SourceConnectorRetryConfig {
    return resolveRetryConfig(this.definition.retryConfig, readFrameworkOverrides(importSource));
  }

  getRateLimitConfig(importSource?: ImportSource): SourceConnectorRateLimitConfig {
    return resolveRateLimitConfig(this.definition.rateLimitConfig, readFrameworkOverrides(importSource));
  }

  abstract fetchRawEvents(
    source: AggregationSource,
    importSource: ImportSource,
    context: PipelineRunContext,
  ): Promise<RawImportedEvent[]>;
}
