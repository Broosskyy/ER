import { describe, expect, it } from 'vitest';

import {
  ConnectorRegistry,
  ConnectorFactory,
  ConnectorFrameworkService,
  ConnectorRegistryError,
  ConnectorValidationError,
  validateConnectorRegistration,
  validateConnectorContext,
  createConnectorCapabilities,
  buildConnectorResultStatistics,
  createEmptyConnectorResult,
} from '@/features/connectors';
import {
  createMockConnectorRegistration,
  createTestConnectorContext,
  createTestSourceRecord,
  MOCK_CONNECTOR_KEY,
  MockConnector,
} from '@/features/connectors/__tests__/test-helpers';

describe('ConnectorRegistry', () => {
  it('registers and resolves connectors by key', () => {
    const registry = new ConnectorRegistry();
    registry.register(createMockConnectorRegistration());
    expect(registry.has(MOCK_CONNECTOR_KEY)).toBe(true);
    expect(registry.listKeys()).toEqual([MOCK_CONNECTOR_KEY]);
  });

  it('rejects duplicate registration', () => {
    const registry = new ConnectorRegistry();
    registry.register(createMockConnectorRegistration());
    expect(() => registry.register(createMockConnectorRegistration())).toThrow(ConnectorRegistryError);
  });

  it('throws when connector is not found', () => {
    const registry = new ConnectorRegistry();
    expect(() => registry.getRegistration('missing')).toThrow(ConnectorRegistryError);
  });

  it('lists descriptors with capabilities', () => {
    const registry = new ConnectorRegistry();
    registry.register(createMockConnectorRegistration());
    expect(registry.listDescriptors()[0]?.capabilities.supportsPolling).toBe(true);
  });
});

describe('ConnectorFactory', () => {
  it('creates connector instances from registration', () => {
    const registry = new ConnectorRegistry();
    registry.register(createMockConnectorRegistration());
    const factory = new ConnectorFactory(registry);
    const connector = factory.create(MOCK_CONNECTOR_KEY);
    expect(connector).toBeInstanceOf(MockConnector);
    expect(connector.connectorKey).toBe(MOCK_CONNECTOR_KEY);
  });
});

describe('Connector validation', () => {
  it('validates connector registration', () => {
    const result = validateConnectorRegistration(createMockConnectorRegistration());
    expect(result.valid).toBe(true);
  });

  it('rejects invalid registration', () => {
    const result = validateConnectorRegistration({
      connectorKey: '',
      displayName: '',
      capabilities: createConnectorCapabilities(),
      create: () => new MockConnector(),
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('validates execution context', () => {
    const result = validateConnectorContext(createTestConnectorContext());
    expect(result.valid).toBe(true);
  });

  it('rejects context without source', () => {
    const result = validateConnectorContext(
      createTestConnectorContext({
        source: createTestSourceRecord({ id: '', displayName: '' }),
      }),
    );
    expect(result.valid).toBe(false);
  });
});

describe('Connector result model', () => {
  it('builds statistics from candidates and issues', () => {
    const stats = buildConnectorResultStatistics({
      candidates: [{ externalId: 'a', rawPayload: {} }],
      warnings: [{ code: 'W1', message: 'warn' }],
      errors: [],
    });
    expect(stats.candidateCount).toBe(1);
    expect(stats.warningCount).toBe(1);
  });

  it('creates empty result defaults', () => {
    const result = createEmptyConnectorResult();
    expect(result.status).toBe('completed');
    expect(result.candidates).toEqual([]);
  });
});

describe('ConnectorFrameworkService', () => {
  it('executes registered connector through framework pipeline', async () => {
    const registry = new ConnectorRegistry();
    registry.register(createMockConnectorRegistration());
    const service = new ConnectorFrameworkService(registry, new ConnectorFactory(registry));

    const result = await service.executeConnector(
      MOCK_CONNECTOR_KEY,
      createTestConnectorContext(),
    );

    expect(result.status).toBe('completed');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.externalId).toBe('mock-candidate-1');
  });

  it('provides framework diagnostics', () => {
    const registry = new ConnectorRegistry();
    registry.register(createMockConnectorRegistration());
    const service = new ConnectorFrameworkService(registry, new ConnectorFactory(registry));
    const diagnostics = service.getDiagnostics();
    expect(diagnostics.registeredCount).toBe(1);
    expect(diagnostics.connectorKeys).toContain(MOCK_CONNECTOR_KEY);
  });

  it('rejects execution with invalid context', async () => {
    const registry = new ConnectorRegistry();
    registry.register(createMockConnectorRegistration());
    const service = new ConnectorFrameworkService(registry, new ConnectorFactory(registry));

    await expect(
      service.executeConnector(MOCK_CONNECTOR_KEY, createTestConnectorContext({
        execution: { executionId: '', startedAt: '' },
      })),
    ).rejects.toThrow(ConnectorValidationError);
  });
});

describe('MockConnector', () => {
  it('returns acquisition candidates only', async () => {
    const connector = new MockConnector();
    const result = await connector.execute(createTestConnectorContext());
    expect(result.candidates[0]).toMatchObject({
      externalId: 'mock-candidate-1',
      rawPayload: { title: 'Mock Event' },
    });
    expect(result).not.toHaveProperty('event');
  });
});
