import type { Connector } from '@/features/connectors/contracts/connector';
import type { ConnectorRegistry } from '@/features/connectors/registry/connector-registry';

export class ConnectorFactory {
  constructor(private readonly registry: ConnectorRegistry) {}

  create(connectorKey: string): Connector {
    const registration = this.registry.getRegistration(connectorKey);
    return registration.create();
  }

  listAvailableKeys(): string[] {
    return this.registry.listKeys();
  }
}
