import type { ConnectorContext } from '@/features/connectors/contracts/connector-context';
import type { ConnectorResult } from '@/features/connectors/contracts/connector-result';
import type { ConnectorDescriptor } from '@/features/connectors/registry/connector-registry';
import type { ConnectorFactory } from '@/features/connectors/registry/connector-factory';
import type { ConnectorRegistry } from '@/features/connectors/registry/connector-registry';
import {
  assertValidConnectorContext,
  validateCapabilitiesConsistency,
  validateConnectorRegistration,
} from '@/features/connectors/domain/connector-validation';
import { ConnectorValidationError } from '@/features/connectors/errors/connector-errors';

export interface ConnectorFrameworkDiagnostics {
  registeredCount: number;
  connectorKeys: string[];
  descriptors: ConnectorDescriptor[];
}

export class ConnectorFrameworkService {
  constructor(
    private readonly registry: ConnectorRegistry,
    private readonly factory: ConnectorFactory,
  ) {}

  listConnectors(): ConnectorDescriptor[] {
    return this.registry.listDescriptors();
  }

  inspectCapabilities(connectorKey: string) {
    return this.registry.inspectCapabilities(connectorKey);
  }

  resolveConnector(connectorKey: string) {
    return this.factory.create(connectorKey);
  }

  getDiagnostics(): ConnectorFrameworkDiagnostics {
    return {
      registeredCount: this.registry.listKeys().length,
      connectorKeys: this.registry.listKeys(),
      descriptors: this.registry.listDescriptors(),
    };
  }

  /**
   * Framework-level validation before connector execution.
   * Does not perform provider-specific checks.
   */
  validateBeforeExecution(connectorKey: string, context: ConnectorContext): void {
    const registration = this.registry.getRegistration(connectorKey);
    const registrationResult = validateConnectorRegistration(registration);
    if (!registrationResult.valid) {
      throw new ConnectorValidationError(
        registrationResult.issues.map((issue) => issue.message).join(' '),
      );
    }

    const capabilityResult = validateCapabilitiesConsistency(registration);
    if (!capabilityResult.valid) {
      throw new ConnectorValidationError(
        capabilityResult.issues.map((issue) => issue.message).join(' '),
      );
    }

    assertValidConnectorContext(context);
  }

  async executeConnector(
    connectorKey: string,
    context: ConnectorContext,
  ): Promise<ConnectorResult> {
    this.validateBeforeExecution(connectorKey, context);
    const connector = this.factory.create(connectorKey);
    const configResult = connector.validateConfiguration(context);
    if (!configResult.valid) {
      throw new ConnectorValidationError(
        configResult.issues.map((issue) => issue.message).join(' '),
      );
    }
    return connector.execute(context);
  }
}
