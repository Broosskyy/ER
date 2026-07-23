import type { ConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';
import type { ConnectorContext } from '@/features/connectors/contracts/connector-context';
import type { ConnectorResult } from '@/features/connectors/contracts/connector-result';

export interface ConnectorValidationIssue {
  field?: string;
  code: string;
  message: string;
}

export interface ConnectorValidationResult {
  valid: boolean;
  issues: ConnectorValidationIssue[];
}

export interface ConnectorHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message?: string;
  checkedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Canonical connector contract.
 * Every future provider implementation must implement this interface.
 */
export interface Connector {
  readonly connectorKey: string;
  readonly displayName: string;

  describeCapabilities(): ConnectorCapabilities;

  validateConfiguration(context: ConnectorContext): ConnectorValidationResult;

  execute(context: ConnectorContext): Promise<ConnectorResult>;

  describeHealth?(context: ConnectorContext): Promise<ConnectorHealthReport>;
}

export interface ConnectorRegistration {
  connectorKey: string;
  displayName: string;
  /** Optional provider version for admin display. */
  version?: string;
  /** Declarative endpoint types this connector supports (metadata only). */
  supportedEndpointTypes?: string[];
  capabilities: ConnectorCapabilities;
  create: () => Connector;
}
