import type { OfficialConnector } from './connector-contract';

export class UnknownOfficialConnectorError extends Error {
  constructor(connectorId: string) {
    super(`unknown_official_connector:${connectorId}`);
    this.name = 'UnknownOfficialConnectorError';
  }
}

export class DuplicateOfficialConnectorError extends Error {
  constructor(connectorId: string) {
    super(`duplicate_official_connector:${connectorId}`);
    this.name = 'DuplicateOfficialConnectorError';
  }
}

export class OfficialSourceRegistry {
  private readonly connectors = new Map<string, OfficialConnector>();

  register(connector: OfficialConnector): void {
    const connectorId = connector.metadata.connectorId;
    if (this.connectors.has(connectorId)) {
      throw new DuplicateOfficialConnectorError(connectorId);
    }
    this.connectors.set(connectorId, connector);
  }

  get(connectorId: string): OfficialConnector {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new UnknownOfficialConnectorError(connectorId);
    }
    return connector;
  }

  listConnectorIds(): string[] {
    return [...this.connectors.keys()].sort();
  }

  list(): OfficialConnector[] {
    return [...this.connectors.values()].sort((left, right) =>
      left.metadata.connectorId.localeCompare(right.metadata.connectorId),
    );
  }
}

let defaultRegistry: OfficialSourceRegistry | undefined;

export function getOfficialSourceRegistry(): OfficialSourceRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new OfficialSourceRegistry();
  }
  return defaultRegistry;
}

export function resetOfficialSourceRegistryForTests(): void {
  defaultRegistry = undefined;
}
