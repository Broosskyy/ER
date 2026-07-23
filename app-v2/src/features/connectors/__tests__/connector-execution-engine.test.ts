import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ConnectorRegistry } from '@/features/connectors/registry/connector-registry';
import { ConnectorFactory } from '@/features/connectors/registry/connector-factory';
import { ConnectorFrameworkService } from '@/features/connectors/services/connector-framework-service';
import { ConnectorExecutionEngine } from '@/features/connectors/services/connector-execution-engine';
import { ConnectorExecutionService } from '@/features/connectors/services/connector-execution-service';
import { InMemoryConnectorExecutionRepository } from '@/features/connectors/repositories/connector-execution-repository';
import type { EndpointExecutionLoader } from '@/features/connectors/domain/endpoint-execution-loader';
import { WEBSITE_CONNECTOR_KEY } from '@/features/connectors/providers/website/website-connector-constants';
import { WebsiteConnector } from '@/features/connectors/providers/website/website-connector';
import {
  createMockConnectorRegistration,
  createTestSourceRecord,
  MOCK_CONNECTOR_KEY,
} from '@/features/connectors/__tests__/test-helpers';
import type { HttpClient, HttpRequestOptions, HttpResponse } from '@/features/endpoints/contracts/http-abstraction';
import { DefaultHttpClient } from '@/features/endpoints/http/default-http-client';
import type { AcquisitionEndpoint } from '@/features/endpoints/domain/endpoint-model';
import type { SourceRecord } from '@/data/types/records';
import type { Connector } from '@/features/connectors/contracts/connector';
import type { ConnectorContext } from '@/features/connectors/contracts/connector-context';
import type { ConnectorResult } from '@/features/connectors/contracts/connector-result';
import { BaseConnector } from '@/features/connectors/base/base-connector';
import { createConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';

function createWebsiteEndpoint(sourceId: string): AcquisitionEndpoint {
  return {
    id: 'ep-website-1',
    sourceId,
    displayName: 'Events page',
    endpointType: 'website',
    connectorKey: WEBSITE_CONNECTOR_KEY,
    url: 'https://example.com/events',
    enabled: true,
    config: { type: 'website', website: { followRedirects: true, maxRedirects: 3 } },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createWebsiteSource(): SourceRecord {
  const endpoint = createWebsiteEndpoint('src-website-1');
  return createTestSourceRecord({
    id: 'src-website-1',
    sourceConfig: { endpoints: [endpoint] },
  });
}

class MockHttpClient implements HttpClient {
  constructor(private readonly handler: (options: HttpRequestOptions) => Promise<HttpResponse>) {}

  request(options: HttpRequestOptions): Promise<HttpResponse> {
    return this.handler(options);
  }
}

class InvalidArrayConnector extends BaseConnector {
  readonly connectorKey = 'invalid-array';
  readonly displayName = 'Invalid Array Connector';
  readonly capabilities = createConnectorCapabilities({ supportsPolling: true });

  validateConfiguration() {
    return { valid: true, issues: [] };
  }

  async execute(): Promise<ConnectorResult> {
    return {
      status: 'completed',
      candidates: 'invalid' as never,
      warnings: [],
      errors: [],
      statistics: {
        candidateCount: 0,
        skippedCount: 0,
        warningCount: 0,
        errorCount: 0,
      },
      diagnostics: {},
      durationMs: 1,
      metadata: {},
    };
  }
}

class MalformedCandidateConnector extends BaseConnector {
  readonly connectorKey = 'malformed-candidate';
  readonly displayName = 'Malformed Candidate Connector';
  readonly capabilities = createConnectorCapabilities({ supportsPolling: true });

  validateConfiguration() {
    return { valid: true, issues: [] };
  }

  async execute(context: ConnectorContext): Promise<ConnectorResult> {
    return this.createSuccessResult(
      {
        candidates: [
          {
            externalId: 'bad',
            rawPayload: { html: '<html></html>' },
          },
        ],
      },
      1,
    );
  }
}

class ThrowingConnector extends BaseConnector {
  readonly connectorKey = 'throwing';
  readonly displayName = 'Throwing Connector';
  readonly capabilities = createConnectorCapabilities({ supportsPolling: true });

  validateConfiguration() {
    return { valid: true, issues: [] };
  }

  async execute(): Promise<ConnectorResult> {
    throw 'plain failure';
  }
}

class SlowConnector extends BaseConnector {
  readonly connectorKey = 'slow';
  readonly displayName = 'Slow Connector';
  readonly capabilities = createConnectorCapabilities({ supportsPolling: true });

  validateConfiguration() {
    return { valid: true, issues: [] };
  }

  async execute(context: ConnectorContext): Promise<ConnectorResult> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (context.runtime?.abortSignal?.aborted) {
      throw new Error('aborted');
    }
    return this.createSuccessResult(
      {
        candidates: [
          {
            externalId: 'slow-1',
            rawPayload: { html: '<html></html>' },
            metadata: {
              endpointId: context.endpoint?.id,
              sourceId: context.source.id,
              retrievedAt: new Date().toISOString(),
            },
          },
        ],
      },
      50,
    );
  }
}

function createEngine(loader: EndpointExecutionLoader, registry: ConnectorRegistry) {
  const factory = new ConnectorFactory(registry);
  const framework = new ConnectorFrameworkService(registry, factory);
  const repository = new InMemoryConnectorExecutionRepository();
  const engine = new ConnectorExecutionEngine(loader, registry, framework, repository);
  return { engine, repository, registry, framework };
}

describe('ConnectorExecutionEngine', () => {
  let registry: ConnectorRegistry;

  beforeEach(() => {
    registry = new ConnectorRegistry();
  });

  it('executes website connector successfully through the engine', async () => {
    const source = createWebsiteSource();
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint: createWebsiteEndpoint(source.id), source }),
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/events',
      headers: {
        get: (name: string) => (name === 'content-type' ? 'text/html; charset=utf-8' : null),
        forEach: (cb: (value: string, key: string) => void) => {
          cb('text/html; charset=utf-8', 'content-type');
        },
      },
      text: async () => '<html><body>events</body></html>',
    });

    const sharedHttpClient = new DefaultHttpClient(fetchImpl);
    registry.register({
      connectorKey: WEBSITE_CONNECTOR_KEY,
      displayName: 'Website Connector',
      version: '1.0.0',
      supportedEndpointTypes: ['website'],
      capabilities: createConnectorCapabilities({ supportsPolling: true }),
      create: () => new WebsiteConnector(sharedHttpClient),
    });

    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({
      endpointId: 'ep-website-1',
      trigger: 'manual',
      requestedBy: 'admin@example.com',
      correlationId: 'corr-test-1',
    });

    expect(result.status).toBe('succeeded');
    expect(result.connectorKey).toBe(WEBSITE_CONNECTOR_KEY);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.rawPayload.html).toBe('<html><body>events</body></html>');
    expect(result.candidates[0]?.normalizedPayload).toBeUndefined();
    expect(result.executionId).toMatch(/^exec_/);
    expect(result.diagnostics.candidateCount).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.logs.some((entry) => entry.code === 'EXECUTION_COMPLETED')).toBe(true);
    expect(result.logs.some((entry) => entry.code === 'EXECUTION_SUCCEEDED')).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails when endpoint is not found', async () => {
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => null,
    };
    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({ endpointId: 'missing', trigger: 'manual' });
    expect(result.status).toBe('failed');
    expect(result.errors[0]?.code).toBe('ENDPOINT_NOT_FOUND');
  });

  it('fails when endpoint is disabled', async () => {
    const source = createWebsiteSource();
    const endpoint = { ...createWebsiteEndpoint(source.id), enabled: false };
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint, source }),
    };
    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({ endpointId: endpoint.id, trigger: 'manual' });
    expect(result.status).toBe('failed');
    expect(result.errors.some((entry) => entry.code === 'ENDPOINT_DISABLED')).toBe(true);
  });

  it('fails when connector is not registered', async () => {
    const source = createWebsiteSource();
    const endpoint = { ...createWebsiteEndpoint(source.id), connectorKey: 'missing-connector' };
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint, source }),
    };
    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({ endpointId: endpoint.id, trigger: 'manual' });
    expect(result.status).toBe('failed');
    expect(result.errors[0]?.code).toBe('CONNECTOR_NOT_FOUND');
  });

  it('fails on connector configuration error', async () => {
    registry.register({
      connectorKey: WEBSITE_CONNECTOR_KEY,
      displayName: 'Website Connector',
      supportedEndpointTypes: ['website'],
      capabilities: createConnectorCapabilities({ supportsPolling: true }),
      create: () =>
        new WebsiteConnector(
          new MockHttpClient(async () => ({
            status: 200,
            headers: {},
            body: '',
            finalUrl: 'https://example.com/events',
            contentType: 'text/html',
            durationMs: 1,
          })),
        ),
    });

    const source = createWebsiteSource();
    const endpoint = {
      ...createWebsiteEndpoint(source.id),
      config: {
        type: 'website' as const,
        website: { requiresJavaScriptRendering: true },
      },
    };
    source.sourceConfig = { endpoints: [endpoint] };
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint, source }),
    };
    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({ endpointId: endpoint.id, trigger: 'manual' });
    expect(result.status).toBe('failed');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('maps transport failures from website connector', async () => {
    const source = createWebsiteSource();
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint: createWebsiteEndpoint(source.id), source }),
    };
    const httpClient = new MockHttpClient(async () => {
      throw new (await import('@/features/endpoints/contracts/http-abstraction')).HttpClientError({
        code: 'HTTP_TIMEOUT',
        message: 'HTTP request timed out.',
        url: 'https://example.com/events',
      });
    });

    registry.register({
      connectorKey: WEBSITE_CONNECTOR_KEY,
      displayName: 'Website Connector',
      supportedEndpointTypes: ['website'],
      capabilities: createConnectorCapabilities({ supportsPolling: true }),
      create: () => new WebsiteConnector(httpClient),
    });

    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({ endpointId: 'ep-website-1', trigger: 'manual' });
    expect(result.status).toBe('failed');
    expect(result.errors[0]?.code).toBe('HTTP_TIMEOUT');
  });

  it('rejects connector contract violations for non-array candidates', async () => {
    registry.register({
      connectorKey: 'invalid-array',
      displayName: 'Invalid Array Connector',
      supportedEndpointTypes: ['website'],
      capabilities: createConnectorCapabilities({ supportsPolling: true }),
      create: () => new InvalidArrayConnector(),
    });

    const source = createWebsiteSource();
    const endpoint = { ...createWebsiteEndpoint(source.id), connectorKey: 'invalid-array' };
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint, source }),
    };
    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({ endpointId: endpoint.id, trigger: 'manual' });
    expect(result.status).toBe('failed');
    expect(result.errors.some((entry) => entry.code === 'CONNECTOR_CONTRACT_VIOLATION')).toBe(true);
  });

  it('rejects malformed candidates without retrievedAt', async () => {
    registry.register({
      connectorKey: 'malformed-candidate',
      displayName: 'Malformed Candidate Connector',
      supportedEndpointTypes: ['website'],
      capabilities: createConnectorCapabilities({ supportsPolling: true }),
      create: () => new MalformedCandidateConnector(),
    });

    const source = createWebsiteSource();
    const endpoint = { ...createWebsiteEndpoint(source.id), connectorKey: 'malformed-candidate' };
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint, source }),
    };
    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({ endpointId: endpoint.id, trigger: 'manual' });
    expect(result.status).toBe('failed');
    expect(result.errors.some((entry) => entry.code === 'CONNECTOR_CONTRACT_VIOLATION')).toBe(true);
  });

  it('maps unexpected connector exceptions', async () => {
    registry.register({
      connectorKey: 'throwing',
      displayName: 'Throwing Connector',
      supportedEndpointTypes: ['website'],
      capabilities: createConnectorCapabilities({ supportsPolling: true }),
      create: () => new ThrowingConnector(),
    });

    const source = createWebsiteSource();
    const endpoint = { ...createWebsiteEndpoint(source.id), connectorKey: 'throwing' };
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint, source }),
    };
    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({ endpointId: endpoint.id, trigger: 'manual' });
    expect(result.status).toBe('failed');
    expect(result.errors[0]?.code).toBe('ENGINE_UNEXPECTED_ERROR');
  });

  it('returns cancelled when aborted before connector execution', async () => {
    const source = createWebsiteSource();
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint: createWebsiteEndpoint(source.id), source }),
    };
    const { engine } = createEngine(loader, registry);
    const controller = new AbortController();
    controller.abort();
    const result = await engine.execute(
      { endpointId: 'ep-website-1', trigger: 'manual' },
      { signal: controller.signal },
    );
    expect(result.status).toBe('cancelled');
    expect(result.logs.some((entry) => entry.code === 'EXECUTION_COMPLETED')).toBe(true);
  });

  it('does not log raw HTML in lifecycle logs', async () => {
    const source = createWebsiteSource();
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint: createWebsiteEndpoint(source.id), source }),
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/events',
      headers: {
        get: (name: string) => (name === 'content-type' ? 'text/html; charset=utf-8' : null),
        forEach: (cb: (value: string, key: string) => void) => {
          cb('text/html; charset=utf-8', 'content-type');
        },
      },
      text: async () => '<html>secret payload</html>',
    });

    registry.register({
      connectorKey: WEBSITE_CONNECTOR_KEY,
      displayName: 'Website Connector',
      supportedEndpointTypes: ['website'],
      capabilities: createConnectorCapabilities({ supportsPolling: true }),
      create: () => new WebsiteConnector(new DefaultHttpClient(fetchImpl)),
    });

    const { engine } = createEngine(loader, registry);
    const result = await engine.execute({ endpointId: 'ep-website-1', trigger: 'manual' });
    const serialized = JSON.stringify(result.logs);
    expect(serialized).not.toContain('secret payload');
    expect(serialized).not.toContain('<html>');
  });

  it('persists execution metadata without raw HTML', async () => {
    const source = createWebsiteSource();
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint: createWebsiteEndpoint(source.id), source }),
    };
    const { engine, repository } = createEngine(loader, registry);
    registry.register({
      connectorKey: MOCK_CONNECTOR_KEY,
      displayName: 'Mock Connector',
      supportedEndpointTypes: ['website'],
      capabilities: createConnectorCapabilities({ supportsPolling: true }),
      create: createMockConnectorRegistration().create,
    });

    const endpoint = { ...createWebsiteEndpoint(source.id), connectorKey: MOCK_CONNECTOR_KEY };
    const customLoader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint, source }),
    };
    const customEngine = new ConnectorExecutionEngine(
      customLoader,
      registry,
      new ConnectorFrameworkService(registry, new ConnectorFactory(registry)),
      repository,
    );

    const result = await customEngine.execute({ endpointId: endpoint.id, trigger: 'test' });
    const stored = await repository.getById(result.executionId);
    expect(stored).not.toBeNull();
    expect(stored?.candidateCount).toBe(result.candidates.length);
    expect(JSON.stringify(stored)).not.toContain('Mock Event');
  });

  it('creates unique execution IDs per request', async () => {
    const source = createWebsiteSource();
    const endpoint = { ...createWebsiteEndpoint(source.id), connectorKey: MOCK_CONNECTOR_KEY };
    registry.register({
      ...createMockConnectorRegistration(),
      supportedEndpointTypes: ['website'],
    });
    const loader: EndpointExecutionLoader = {
      loadByEndpointId: async () => ({ endpoint, source }),
    };
    const { engine } = createEngine(loader, registry);
    const first = await engine.execute({ endpointId: endpoint.id, trigger: 'manual' });
    const second = await engine.execute({ endpointId: endpoint.id, trigger: 'manual' });
    expect(first.executionId).not.toBe(second.executionId);
  });
});

describe('ConnectorExecutionService', () => {
  it('requires admin permission for manual execution', async () => {
    const engine = {
      execute: vi.fn(),
    } as unknown as ConnectorExecutionEngine;
    const service = new ConnectorExecutionService(engine);
    await expect(
      service.executeEndpoint(null, { endpointId: 'ep-1', trigger: 'manual' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('delegates authorized execution to the engine', async () => {
    const engine = {
      execute: vi.fn().mockResolvedValue({
        executionId: 'exec-1',
        status: 'succeeded',
      }),
    } as unknown as ConnectorExecutionEngine;
    const service = new ConnectorExecutionService(engine);
    await service.executeEndpoint('admin', { endpointId: 'ep-1', trigger: 'manual' });
    expect(engine.execute).toHaveBeenCalledTimes(1);
  });
});
