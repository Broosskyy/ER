import { describe, expect, it, beforeEach } from 'vitest';

import { ConnectorRegistry } from '@/features/connectors/registry/connector-registry';
import { ConnectorFactory } from '@/features/connectors/registry/connector-factory';
import { ConnectorFrameworkService } from '@/features/connectors/services/connector-framework-service';
import { ConnectorAdminService } from '@/features/connectors/services/connector-admin-service';
import { ConnectorConfigStore } from '@/features/connectors/admin/connector-config-store';
import {
  createMockConnectorRegistration,
  createTestSourceRecord,
  MOCK_CONNECTOR_KEY,
} from '@/features/connectors/__tests__/test-helpers';

describe('ConnectorAdminService', () => {
  let registry: ConnectorRegistry;
  let adminService: ConnectorAdminService;
  let configStore: ConnectorConfigStore;
  const sources = new Map<string, ReturnType<typeof createTestSourceRecord>>();
  const memoryStorage = new Map<string, string>();

  beforeEach(() => {
    registry = new ConnectorRegistry();
    registry.register(createMockConnectorRegistration());
    memoryStorage.clear();
    configStore = new ConnectorConfigStore({
      getItem: async (key) => memoryStorage.get(key) ?? null,
      setItem: async (key, value) => {
        memoryStorage.set(key, value);
      },
    });
    configStore.resetForTests();

    const framework = new ConnectorFrameworkService(registry, new ConnectorFactory(registry));
    const sourceReader = {
      async getByIdForAdmin(_role: 'owner' | null, id: string) {
        return sources.get(id) ?? null;
      },
    };
    const sourceWriter = {
      async updateConnectorAssignment(
        _role: 'owner' | null,
        sourceId: string,
        connectorKey: string | undefined,
        endpointPlaceholder?: string,
      ) {
        const existing = sources.get(sourceId);
        if (!existing) {
          throw new Error('Source not found.');
        }
        const updated = {
          ...existing,
          sourceConfig: {
            ...(existing.sourceConfig ?? {}),
            connector: connectorKey
              ? { connectorKey, endpointPlaceholder }
              : undefined,
          },
        };
        sources.set(sourceId, updated);
        return updated;
      },
    };

    adminService = new ConnectorAdminService(
      framework,
      registry,
      configStore,
      sourceReader,
      sourceWriter,
    );

    sources.set('src-1', createTestSourceRecord({ id: 'src-1' }));
  });

  it('lists registered connectors for authorized roles', async () => {
    const items = await adminService.listForAdmin('owner');
    expect(items).toHaveLength(1);
    expect(items[0]?.connectorKey).toBe(MOCK_CONNECTOR_KEY);
  });

  it('rejects unauthorized access', async () => {
    await expect(adminService.listForAdmin(null)).rejects.toThrow('Authentication required');
    await expect(adminService.updateGlobalSettings(null, {
      enabled: true,
      defaultTimeoutMs: 30_000,
      maxRetries: 0,
      maxConcurrentExecutions: 1,
      diagnosticsEnabled: true,
      featureFlags: {},
    })).rejects.toThrow('permission');
  });

  it('returns diagnostics without external requests', async () => {
    const diagnostics = await adminService.getDiagnostics('owner');
    expect(diagnostics.frameworkReady).toBe(true);
    expect(diagnostics.executionAvailable).toBe(true);
    expect(diagnostics.registeredCount).toBe(1);
  });

  it('returns connector detail with capabilities', async () => {
    const detail = await adminService.getConnectorDetail('owner', MOCK_CONNECTOR_KEY);
    expect(detail.capabilityDisplay.length).toBeGreaterThan(0);
    expect(detail.healthStatus).toBe('ready');
  });

  it('validates and saves connector settings', async () => {
    const detail = await adminService.updateConnectorSettings('owner', MOCK_CONNECTOR_KEY, {
      enabled: true,
      defaultTimeoutMs: 45_000,
      maxRetries: 1,
      maxConcurrentExecutions: 2,
      diagnosticsEnabled: true,
      featureFlags: {},
    });
    expect(detail.settings.defaultTimeoutMs).toBe(45_000);
  });

  it('assigns connector to source', async () => {
    const assignment = await adminService.assignConnectorToSource(
      'owner',
      'src-1',
      MOCK_CONNECTOR_KEY,
      'Primary feed',
    );
    expect(assignment.connectorKey).toBe(MOCK_CONNECTOR_KEY);
    expect(assignment.endpointPlaceholder).toBe('Primary feed');
  });

  it('rejects unsupported connector assignment', async () => {
    await expect(
      adminService.assignConnectorToSource('owner', 'src-1', 'missing'),
    ).rejects.toThrow();
  });
});
