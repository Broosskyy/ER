export type { ConnectorLifecycleState } from '@/features/connectors/domain/connector-lifecycle';
export {
  CONNECTOR_LIFECYCLE_STATES,
  isConnectorLifecycleState,
} from '@/features/connectors/domain/connector-lifecycle';

export type { ConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';
export {
  EMPTY_CONNECTOR_CAPABILITIES,
  createConnectorCapabilities,
} from '@/features/connectors/domain/connector-capabilities';

export type {
  ConnectorErrorCategory,
  ConnectorErrorCode,
  ConnectorErrorDetail,
} from '@/features/connectors/errors/connector-errors';
export {
  CONNECTOR_ERROR_CATEGORIES,
  ConnectorError,
  ConnectorRegistryError,
  ConnectorValidationError,
  ConnectorExecutionError,
  createConnectorErrorDetail,
} from '@/features/connectors/errors/connector-errors';

export type {
  ConnectorEndpointRef,
  ConnectorExecutionMetadata,
  ConnectorRuntimeHints,
  ConnectorAuthenticationContext,
  ConnectorRateLimitContext,
  ConnectorLogLevel,
  ConnectorContext,
} from '@/features/connectors/contracts/connector-context';

export type {
  ConnectorResultStatus,
  AcquisitionCandidate,
  ConnectorWarning,
  ConnectorResultStatistics,
  ConnectorResult,
} from '@/features/connectors/contracts/connector-result';
export {
  CONNECTOR_RESULT_STATUSES,
  createEmptyConnectorResult,
  buildConnectorResultStatistics,
} from '@/features/connectors/contracts/connector-result';

export type {
  ConnectorValidationIssue,
  ConnectorValidationResult,
  ConnectorHealthReport,
  Connector,
  ConnectorRegistration,
} from '@/features/connectors/contracts/connector';

export { BaseConnector } from '@/features/connectors/base/base-connector';

export {
  ConnectorRegistry,
  connectorRegistry,
  type ConnectorDescriptor,
} from '@/features/connectors/registry/connector-registry';
export { ConnectorFactory } from '@/features/connectors/registry/connector-factory';

export {
  validateConnectorRegistration,
  validateConnectorContext,
  assertValidConnectorContext,
  validateCapabilitiesConsistency,
} from '@/features/connectors/domain/connector-validation';

export {
  ConnectorFrameworkService,
  type ConnectorFrameworkDiagnostics,
} from '@/features/connectors/services/connector-framework-service';

export { registerConnectors } from '@/features/connectors/register-connectors';

export { WebsiteConnector } from '@/features/connectors/providers/website/website-connector';
export { WEBSITE_CONNECTOR_KEY } from '@/features/connectors/providers/website/website-connector-constants';

export type {
  ConnectorFrameworkSettings,
  ConnectorGlobalFrameworkSettings,
  ConnectorHealthStatus,
  ConnectorSourceAssignment,
} from '@/features/connectors/domain/connector-config';
export {
  CONNECTOR_HEALTH_STATUSES,
  DEFAULT_CONNECTOR_FRAMEWORK_SETTINGS,
  DEFAULT_CONNECTOR_GLOBAL_SETTINGS,
  createDefaultConnectorSettings,
} from '@/features/connectors/domain/connector-config';

export {
  formatConnectorHealthStatus,
  formatConnectorLifecycleState,
  buildConnectorCapabilityDisplay,
} from '@/features/connectors/admin/connector-labels';

export { ConnectorExecutionService } from '@/features/connectors/services/connector-execution-service';
export { ConnectorExecutionEngine } from '@/features/connectors/services/connector-execution-engine';
export type {
  ConnectorExecutionRequest,
  ConnectorExecutionResult,
  ConnectorExecutionStatus,
  ConnectorExecutionTrigger,
  ConnectorExecutionDiagnostics,
  ConnectorExecutionLogEntry,
  ConnectorExecutionRecord,
} from '@/features/connectors/contracts/connector-execution';
export {
  CONNECTOR_EXECUTION_TRIGGERS,
  CONNECTOR_EXECUTION_STATUSES,
} from '@/features/connectors/contracts/connector-execution';
export {
  InMemoryConnectorExecutionRepository,
  type ConnectorExecutionRepository,
} from '@/features/connectors/repositories/connector-execution-repository';
export {
  SourceConfigEndpointExecutionLoader,
  type EndpointExecutionLoader,
  type LoadedExecutableEndpoint,
} from '@/features/connectors/domain/endpoint-execution-loader';

export { ConnectorAdminService } from '@/features/connectors/services/connector-admin-service';
export type {
  ConnectorAdminListItem,
  ConnectorAdminDetail,
  ConnectorFrameworkDiagnosticsView,
  ConnectorSourceAssignmentView,
} from '@/features/connectors/services/connector-admin-service';
