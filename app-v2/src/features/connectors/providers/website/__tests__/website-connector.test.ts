import { describe, expect, it, vi } from 'vitest';

import type { ConnectorContext } from '@/features/connectors/contracts/connector-context';
import type { HttpClient, HttpRequestOptions, HttpResponse } from '@/features/endpoints/contracts/http-abstraction';
import { HttpClientError } from '@/features/endpoints/contracts/http-abstraction';
import { WebsiteConnector } from '@/features/connectors/providers/website/website-connector';
import {
  validateWebsiteConnectorConfiguration,
  resolveWebsiteEndpoint,
} from '@/features/connectors/providers/website/website-connector-validation';
import { WEBSITE_CONNECTOR_KEY } from '@/features/connectors/providers/website/website-connector-constants';
import { createTestSourceRecord } from '@/features/connectors/__tests__/test-helpers';

function createWebsiteContext(
  overrides: Partial<ConnectorContext> = {},
): ConnectorContext {
  const source = createTestSourceRecord({
    id: 'src-website-1',
    sourceConfig: {
      endpoints: [
        {
          id: 'ep-website-1',
          sourceId: 'src-website-1',
          displayName: 'Events page',
          endpointType: 'website',
          connectorKey: WEBSITE_CONNECTOR_KEY,
          url: 'https://example.com/events',
          enabled: true,
          config: { type: 'website', website: { followRedirects: true, maxRedirects: 3 } },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  });

  return {
    source,
    endpoint: {
      id: 'ep-website-1',
      label: 'Events page',
      url: 'https://example.com/events',
      endpointType: 'website',
    },
    execution: {
      executionId: 'exec-website-1',
      startedAt: new Date().toISOString(),
      triggerType: 'manual',
    },
    log: overrides.log ?? vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

class MockHttpClient implements HttpClient {
  constructor(
    private readonly handler: (options: HttpRequestOptions) => Promise<HttpResponse>,
  ) {}

  request(options: HttpRequestOptions): Promise<HttpResponse> {
    return this.handler(options);
  }
}

describe('WebsiteConnector validation', () => {
  it('validates enabled website endpoint configuration', () => {
    const result = validateWebsiteConnectorConfiguration(createWebsiteContext());
    expect(result.valid).toBe(true);
  });

  it('rejects missing endpoint URL', () => {
    const context = createWebsiteContext({
      endpoint: { id: 'ep-website-1', endpointType: 'website' },
    });
    const result = validateWebsiteConnectorConfiguration(context);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'WEBSITE_URL_REQUIRED')).toBe(true);
  });

  it('rejects wrong endpoint type', () => {
    const context = createWebsiteContext({
      endpoint: {
        id: 'ep-website-1',
        url: 'https://example.com/events',
        endpointType: 'rss',
      },
    });
    const result = validateWebsiteConnectorConfiguration(context);
    expect(result.valid).toBe(false);
  });

  it('rejects disabled endpoints', () => {
    const context = createWebsiteContext();
    const source = {
      ...context.source,
      sourceConfig: {
        endpoints: context.source.sourceConfig?.endpoints?.map((entry) => ({
          ...entry,
          enabled: false,
        })),
      },
    };
    const result = validateWebsiteConnectorConfiguration({ ...context, source });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'WEBSITE_ENDPOINT_DISABLED')).toBe(true);
  });

  it('rejects javascript rendering requirement', () => {
    const context = createWebsiteContext();
    const source = {
      ...context.source,
      sourceConfig: {
        endpoints: context.source.sourceConfig?.endpoints?.map((entry) => ({
          ...entry,
          config: {
            type: 'website' as const,
            website: { requiresJavaScriptRendering: true },
          },
        })),
      },
    };
    const result = validateWebsiteConnectorConfiguration({ ...context, source });
    expect(result.valid).toBe(false);
  });
});

describe('WebsiteConnector execution', () => {
  it('produces exactly one AcquisitionCandidate on success', async () => {
    const httpClient = new MockHttpClient(async () => ({
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: '<html><body>Events</body></html>',
      finalUrl: 'https://example.com/events',
      contentType: 'text/html',
      durationMs: 12,
    }));

    const connector = new WebsiteConnector(httpClient);
    const result = await connector.execute(createWebsiteContext());

    expect(result.status).toBe('completed');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.rawPayload.html).toContain('Events');
    expect(result.candidates[0]?.normalizedPayload).toBeUndefined();
    expect(result.candidates[0]?.metadata?.endpointId).toBe('ep-website-1');
    expect(result.candidates[0]?.metadata?.sourceId).toBe('src-website-1');
    expect(result.diagnostics.httpStatus).toBe(200);
  });

  it('maps transport failures to connector errors', async () => {
    const httpClient = new MockHttpClient(async () => {
      throw new HttpClientError({
        code: 'HTTP_TIMEOUT',
        message: 'HTTP request timed out.',
        retryable: true,
      });
    });

    const connector = new WebsiteConnector(httpClient);
    const result = await connector.execute(createWebsiteContext());

    expect(result.status).toBe('failed');
    expect(result.candidates).toHaveLength(0);
    expect(result.errors[0]?.category).toBe('timeout');
  });

  it('logs execution lifecycle events', async () => {
    const log = vi.fn().mockResolvedValue(undefined);
    const httpClient = new MockHttpClient(async () => ({
      status: 200,
      headers: {},
      body: '<html></html>',
      finalUrl: 'https://example.com/events',
      durationMs: 5,
    }));

    const connector = new WebsiteConnector(httpClient);
    await connector.execute(createWebsiteContext({ log }));

    const codes = log.mock.calls.map((call) => call[1]);
    expect(codes).toContain('WEBSITE_EXECUTE_START');
    expect(codes).toContain('WEBSITE_REQUEST_START');
    expect(codes).toContain('WEBSITE_RESPONSE_RECEIVED');
    expect(codes).toContain('WEBSITE_EXECUTE_COMPLETE');
  });

  it('passes timeout and content type options to HttpClient', async () => {
    const requestSpy = vi.fn(async (): Promise<HttpResponse> => ({
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: '<html></html>',
      finalUrl: 'https://example.com/events',
      durationMs: 1,
    }));
    const connector = new WebsiteConnector(new MockHttpClient(requestSpy));
    await connector.execute(createWebsiteContext());

    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/events',
        timeoutMs: expect.any(Number),
        acceptedContentTypes: expect.arrayContaining(['text/html']),
      }),
    );
  });
});

describe('resolveWebsiteEndpoint', () => {
  it('resolves connectorKey from stored endpoint', () => {
    const resolved = resolveWebsiteEndpoint(createWebsiteContext());
    expect(resolved?.connectorKey).toBe(WEBSITE_CONNECTOR_KEY);
    expect(resolved?.url).toBe('https://example.com/events');
  });
});
