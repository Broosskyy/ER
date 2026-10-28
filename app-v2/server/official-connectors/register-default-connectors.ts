import { AffenkaefigOfficialConnector } from './affenkaefig/affenkaefig-official-connector';
import { BootshausOfficialConnector } from './bootshaus/bootshaus-official-connector';
import { getOfficialSourceRegistry } from './source-registry';
import { RausgegangenOfficialConnector, type RausgegangenOfficialConnectorOptions } from './rausgegangen-discovery/rausgegangen-official-connector';
import { RAUSGEGANGEN_DISCOVERY_CONNECTOR_ID } from './rausgegangen-discovery/constants';
import { ZakkOfficialConnector } from './zakk/zakk-official-connector';
import { ZAKK_CONNECTOR_ID } from './zakk/constants';
import { TicketIoOrganizerOfficialConnector, TICKETIO_ORGANIZER_CONNECTOR_ID } from './ticketio-organizer/ticketio-organizer-official-connector';
import { StadtgartenOfficialConnector } from './stadtgarten/stadtgarten-official-connector';
import { STADTGARTEN_CONNECTOR_ID } from './stadtgarten/constants';
import { TresorOfficialConnector } from './tresor/tresor-official-connector';
import { OdonienOfficialConnector } from './odonien/odonien-official-connector';

export function registerDefaultOfficialConnectors(
  registry = getOfficialSourceRegistry(),
  rausgegangenOptions: RausgegangenOfficialConnectorOptions = {},
): void {
  const connectorIds = new Set(registry.listConnectorIds());
  if (!connectorIds.has('tresor-berlin-official')) registry.register(new TresorOfficialConnector());
  if (!connectorIds.has('odonien-club-official')) registry.register(new OdonienOfficialConnector());
  if (!connectorIds.has('bootshaus-official')) {
    registry.register(new BootshausOfficialConnector());
  }
  if (!connectorIds.has('affenkaefig-official')) {
    registry.register(new AffenkaefigOfficialConnector());
  }
  if (!connectorIds.has(STADTGARTEN_CONNECTOR_ID)) {
    registry.register(new StadtgartenOfficialConnector());
  }
  if (!connectorIds.has(TICKETIO_ORGANIZER_CONNECTOR_ID)) {
    registry.register(new TicketIoOrganizerOfficialConnector());
  }
  if (!connectorIds.has(ZAKK_CONNECTOR_ID)) {
    registry.register(new ZakkOfficialConnector());
  }
  if (!connectorIds.has(RAUSGEGANGEN_DISCOVERY_CONNECTOR_ID)) {
    registry.register(new RausgegangenOfficialConnector(rausgegangenOptions));
  }
}
