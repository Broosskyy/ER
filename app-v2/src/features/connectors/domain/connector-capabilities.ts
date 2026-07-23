/**
 * Describes what a connector supports without executing acquisition.
 * Capability flags are declarative metadata only.
 */
export interface ConnectorCapabilities {
  supportsAuthentication: boolean;
  supportsPolling: boolean;
  supportsWebhook: boolean;
  supportsPagination: boolean;
  supportsIncrementalSync: boolean;
}

export const EMPTY_CONNECTOR_CAPABILITIES: ConnectorCapabilities = {
  supportsAuthentication: false,
  supportsPolling: false,
  supportsWebhook: false,
  supportsPagination: false,
  supportsIncrementalSync: false,
};

export function createConnectorCapabilities(
  overrides: Partial<ConnectorCapabilities> = {},
): ConnectorCapabilities {
  return {
    ...EMPTY_CONNECTOR_CAPABILITIES,
    ...overrides,
  };
}
