import { AffenkaefigOfficialConnector } from './affenkaefig/affenkaefig-official-connector';
import { BootshausOfficialConnector } from './bootshaus/bootshaus-official-connector';
import { getOfficialSourceRegistry } from './source-registry';
import { RausgegangenOfficialConnector, type RausgegangenOfficialConnectorOptions } from './rausgegangen-discovery/rausgegangen-official-connector';
import { RAUSGEGANGEN_DISCOVERY_CONNECTOR_ID } from './rausgegangen-discovery/constants';

export function registerDefaultOfficialConnectors(
  registry = getOfficialSourceRegistry(),
  rausgegangenOptions: RausgegangenOfficialConnectorOptions = {},
): void {
  const connectorIds = new Set(registry.listConnectorIds());
  if (!connectorIds.has('bootshaus-official')) {
    registry.register(new BootshausOfficialConnector());
  }
  if (!connectorIds.has('affenkaefig-official')) {
    registry.register(new AffenkaefigOfficialConnector());
  }
  if (!connectorIds.has(RAUSGEGANGEN_DISCOVERY_CONNECTOR_ID)) {
    registry.register(new RausgegangenOfficialConnector(rausgegangenOptions));
  }
}
