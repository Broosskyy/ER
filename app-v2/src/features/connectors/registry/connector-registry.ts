import { ConnectorRegistryError } from '@/features/connectors/errors/connector-errors';
import type {
  Connector,
  ConnectorRegistration,
} from '@/features/connectors/contracts/connector';
import type { ConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';

export interface ConnectorDescriptor {
  connectorKey: string;
  displayName: string;
  version?: string;
  supportedEndpointTypes: string[];
  capabilities: ConnectorCapabilities;
}

export class ConnectorRegistry {
  private readonly registrations = new Map<string, ConnectorRegistration>();

  register(registration: ConnectorRegistration): void {
    const key = registration.connectorKey.trim();
    if (!key) {
      throw new ConnectorRegistryError(
        'Connector key must not be empty.',
        'CONNECTOR_INVALID',
      );
    }
    if (this.registrations.has(key)) {
      throw new ConnectorRegistryError(
        `Connector with key "${key}" is already registered.`,
        'CONNECTOR_DUPLICATE',
      );
    }
    this.registrations.set(key, registration);
  }

  getRegistration(connectorKey: string): ConnectorRegistration {
    const registration = this.registrations.get(connectorKey);
    if (!registration) {
      throw new ConnectorRegistryError(
        `No connector registered for key "${connectorKey}".`,
        'CONNECTOR_NOT_FOUND',
      );
    }
    return registration;
  }

  has(connectorKey: string): boolean {
    return this.registrations.has(connectorKey);
  }

  listKeys(): string[] {
    return [...this.registrations.keys()];
  }

  listDescriptors(): ConnectorDescriptor[] {
    return [...this.registrations.values()].map((registration) => ({
      connectorKey: registration.connectorKey,
      displayName: registration.displayName,
      version: registration.version,
      supportedEndpointTypes: registration.supportedEndpointTypes ?? [],
      capabilities: registration.capabilities,
    }));
  }

  inspectCapabilities(connectorKey: string): ConnectorCapabilities {
    return this.getRegistration(connectorKey).capabilities;
  }
}

export const connectorRegistry = new ConnectorRegistry();
