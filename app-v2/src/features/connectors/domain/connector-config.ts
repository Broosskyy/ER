export const CONNECTOR_HEALTH_STATUSES = [
  'ready',
  'configuration_required',
  'disabled',
  'unsupported',
  'unknown',
] as const;

export type ConnectorHealthStatus = (typeof CONNECTOR_HEALTH_STATUSES)[number];

export interface ConnectorFrameworkSettings {
  enabled: boolean;
  defaultTimeoutMs: number;
  /** Placeholder — retry policy not implemented in ER-013. */
  maxRetries: number;
  /** Placeholder — execution limits not enforced in ER-013. */
  maxConcurrentExecutions: number;
  diagnosticsEnabled: boolean;
  featureFlags: Record<string, boolean>;
  /** Placeholder for future authentication provider selection. */
  authenticationMechanismPlaceholder?: string;
}

export const DEFAULT_CONNECTOR_FRAMEWORK_SETTINGS: ConnectorFrameworkSettings = {
  enabled: true,
  defaultTimeoutMs: 30_000,
  maxRetries: 0,
  maxConcurrentExecutions: 1,
  diagnosticsEnabled: true,
  featureFlags: {},
};

export interface ConnectorGlobalFrameworkSettings extends ConnectorFrameworkSettings {
  frameworkReadyMessage?: string;
}

export const DEFAULT_CONNECTOR_GLOBAL_SETTINGS: ConnectorGlobalFrameworkSettings = {
  ...DEFAULT_CONNECTOR_FRAMEWORK_SETTINGS,
  frameworkReadyMessage: 'Connector framework is ready. Execution is not yet available.',
};

export interface ConnectorSourceAssignment {
  connectorKey?: string;
  /** Prepared for future endpoint management — metadata only. */
  endpointPlaceholder?: string;
}

export function createDefaultConnectorSettings(): ConnectorFrameworkSettings {
  return {
    ...DEFAULT_CONNECTOR_FRAMEWORK_SETTINGS,
    featureFlags: {},
  };
}
