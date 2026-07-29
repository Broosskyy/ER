export type {
  SourceConnectorCapabilities,
} from '@/features/aggregation/connectors/framework/capabilities';
export {
  EMPTY_SOURCE_CONNECTOR_CAPABILITIES,
  createSourceConnectorCapabilities,
} from '@/features/aggregation/connectors/framework/capabilities';

export type { SourceConnectorVersionInfo } from '@/features/aggregation/connectors/framework/versioning';
export {
  SOURCE_CONNECTOR_REGISTRY_VERSION,
  createSourceConnectorVersion,
  isRegistryVersionCompatible,
} from '@/features/aggregation/connectors/framework/versioning';

export type {
  SourceConnectorHealthStatus,
  SourceConnectorHealthSnapshot,
} from '@/features/aggregation/connectors/framework/health';
export {
  SOURCE_CONNECTOR_HEALTH_STATUSES,
  createInitialHealthSnapshot,
  resolveHealthStatusFromErrorCode,
} from '@/features/aggregation/connectors/framework/health';

export type {
  SourceConnectorErrorCode,
  SourceConnectorErrorDetail,
} from '@/features/aggregation/connectors/framework/errors';
export {
  SOURCE_CONNECTOR_ERROR_CODES,
  SourceConnectorError,
  createSourceConnectorErrorDetail,
  isRetryableSourceConnectorError,
} from '@/features/aggregation/connectors/framework/errors';

export type {
  SourceConnectorRetryConfig,
  SourceConnectorRateLimitConfig,
  SourceConnectorFrameworkOverrides,
} from '@/features/aggregation/connectors/framework/config';
export {
  DEFAULT_SOURCE_CONNECTOR_RETRY_CONFIG,
  DEFAULT_SOURCE_CONNECTOR_RATE_LIMIT_CONFIG,
  resolveRetryConfig,
  resolveRateLimitConfig,
} from '@/features/aggregation/connectors/framework/config';

export type {
  SourceConnectorDiagnostics,
  SourceConnectorDiagnosticsWarning,
  SourceConnectorMappingIssue,
} from '@/features/aggregation/connectors/framework/diagnostics';
export {
  createEmptyDiagnostics,
  detectMappingIssues,
} from '@/features/aggregation/connectors/framework/diagnostics';

export type { SourceConnectorMetrics } from '@/features/aggregation/connectors/framework/metrics';
export {
  createInitialMetrics,
  recordConnectorRunMetrics,
} from '@/features/aggregation/connectors/framework/metrics';

export type {
  SourceConnectorDescriptor,
  SourceConnectorDefinition,
} from '@/features/aggregation/connectors/framework/descriptor';

export {
  SOURCE_CONNECTOR_DEFINITIONS,
  getSourceConnectorDefinition,
} from '@/features/aggregation/connectors/framework/connector-definitions';

export type { RegisteredSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';
export { BaseSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';

export {
  classifySourceConnectorError,
  isRetryableConnectorFailure,
} from '@/features/aggregation/connectors/framework/error-classifier';

export type {
  SourceConnectorRetryDecision,
  SourceConnectorRetryMetadata,
} from '@/features/aggregation/connectors/framework/retry';
export {
  resolveSourceConnectorRetry,
  buildRetryMetadata,
  sleep,
} from '@/features/aggregation/connectors/framework/retry';

export type { RateLimitAcquisitionResult } from '@/features/aggregation/connectors/framework/rate-limit';
export {
  SourceConnectorRateLimiter,
  sourceConnectorRateLimiter,
} from '@/features/aggregation/connectors/framework/rate-limit';

export type {
  SourceConnectorExecutionResult,
  SourceConnectorExecutionObserver,
} from '@/features/aggregation/connectors/framework/source-connector-executor';
export { SourceConnectorExecutor } from '@/features/aggregation/connectors/framework/source-connector-executor';
