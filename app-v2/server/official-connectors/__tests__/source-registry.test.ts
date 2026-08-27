import { describe, expect, it, beforeEach } from 'vitest';

import { AFFENKAEFIG_CONNECTOR_ID } from '../affenkaefig/constants';
import { BootshausOfficialConnector } from '../bootshaus/bootshaus-official-connector';
import { BOOTSHAUS_CONNECTOR_ID } from '../bootshaus/constants';
import { registerDefaultOfficialConnectors } from '../register-default-connectors';
import {
  DuplicateOfficialConnectorError,
  getOfficialSourceRegistry,
  OfficialSourceRegistry,
  resetOfficialSourceRegistryForTests,
  UnknownOfficialConnectorError,
} from '../source-registry';

describe('official source registry', () => {
  beforeEach(() => {
    resetOfficialSourceRegistryForTests();
  });

  it('registers default official connectors', () => {
    registerDefaultOfficialConnectors();
    const registry = getOfficialSourceRegistry();

    expect(registry.listConnectorIds()).toEqual([AFFENKAEFIG_CONNECTOR_ID, BOOTSHAUS_CONNECTOR_ID]);
    expect(registry.get(BOOTSHAUS_CONNECTOR_ID).metadata.displayName).toBe('Bootshaus Official');
  });

  it('throws for unknown connector ids', () => {
    const registry = new OfficialSourceRegistry();
    expect(() => registry.get('missing-connector')).toThrow(UnknownOfficialConnectorError);
  });

  it('rejects duplicate connector ids', () => {
    const registry = new OfficialSourceRegistry();
    registry.register(new BootshausOfficialConnector());
    expect(() => registry.register(new BootshausOfficialConnector())).toThrow(
      DuplicateOfficialConnectorError,
    );
  });

  it('does not apply connector-specific lookup logic beyond connectorId', () => {
    const registry = new OfficialSourceRegistry();
    registry.register(new BootshausOfficialConnector());

    const listed = registry.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.metadata.connectorId).toBe(BOOTSHAUS_CONNECTOR_ID);
    expect(listed[0]?.metadata.sourceType).toBe('venue_club');
  });
});
