import { BootshausOfficialConnector } from './bootshaus/bootshaus-official-connector';
import { getOfficialSourceRegistry } from './source-registry';

export function registerDefaultOfficialConnectors(
  registry = getOfficialSourceRegistry(),
): void {
  const connectorIds = new Set(registry.listConnectorIds());
  if (!connectorIds.has('bootshaus-official')) {
    registry.register(new BootshausOfficialConnector());
  }
}
