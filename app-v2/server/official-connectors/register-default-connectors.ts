import { AffenkaefigOfficialConnector } from './affenkaefig/affenkaefig-official-connector';
import { BootshausOfficialConnector } from './bootshaus/bootshaus-official-connector';
import { NachtresidenzOfficialConnector } from './nachtresidenz/nachtresidenz-official-connector';
import { StadtgartenOfficialConnector } from './stadtgarten/stadtgarten-official-connector';
import { getOfficialSourceRegistry } from './source-registry';

export function registerDefaultOfficialConnectors(
  registry = getOfficialSourceRegistry(),
): void {
  const connectorIds = new Set(registry.listConnectorIds());
  if (!connectorIds.has('bootshaus-official')) {
    registry.register(new BootshausOfficialConnector());
  }
  if (!connectorIds.has('affenkaefig-official')) {
    registry.register(new AffenkaefigOfficialConnector());
  }
  if (!connectorIds.has('nachtresidenz-official')) {
    registry.register(new NachtresidenzOfficialConnector());
  }
  if (!connectorIds.has('stadtgarten-official')) {
    registry.register(new StadtgartenOfficialConnector());
  }
}
