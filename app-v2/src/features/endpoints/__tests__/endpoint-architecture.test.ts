import { describe, expect, it } from 'vitest';

import {
  validateAcquisitionEndpoint,
  resolveConnectorKeyForEndpoint,
  applyDefaultConnectorKeyForEndpoint,
  suggestConnectorKeyForEndpointType,
  resolveEndpointConnector,
  mapEndpointToConnectorRef,
  mapHttpErrorToConnectorCategory,
  mapWebsiteAcquisitionError,
  HttpClientError,
  mapHttpClientErrorToConnectorDetail,
} from '@/features/endpoints';
import { ConnectorRegistry } from '@/features/connectors/registry/connector-registry';
import { createMockConnectorRegistration } from '@/features/connectors/__tests__/test-helpers';

function createWebsiteEndpoint(
  overrides: Partial<import('@/features/endpoints').AcquisitionEndpoint> = {},
) {
  const now = new Date().toISOString();
  return {
    id: 'ep-website-1',
    sourceId: 'src-1',
    displayName: 'Events page',
    endpointType: 'website' as const,
    connectorKey: 'website',
    url: 'https://example.com/events',
    enabled: true,
    config: { type: 'website' as const, website: { followRedirects: true } },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AcquisitionEndpoint validation', () => {
  it('validates a complete website endpoint', () => {
    const result = validateAcquisitionEndpoint(createWebsiteEndpoint());
    expect(result.valid).toBe(true);
  });

  it('requires URL for website endpoints', () => {
    const result = validateAcquisitionEndpoint(createWebsiteEndpoint({ url: undefined }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'URL_REQUIRED')).toBe(true);
  });

  it('rejects config type mismatch', () => {
    const result = validateAcquisitionEndpoint(
      createWebsiteEndpoint({
        config: { type: 'rss', rss: {} },
      }),
    );
    expect(result.valid).toBe(false);
  });
});

describe('Endpoint connector resolution', () => {
  it('resolves connector key from endpoint.connectorKey only', () => {
    expect(resolveConnectorKeyForEndpoint(createWebsiteEndpoint())).toBe('website');
  });

  it('rejects runtime resolution when connectorKey is missing', () => {
    expect(() =>
      resolveConnectorKeyForEndpoint(createWebsiteEndpoint({ connectorKey: '' })),
    ).toThrow('connectorKey is required');
  });

  it('applies default connector key at creation time only', () => {
    const withDefault = applyDefaultConnectorKeyForEndpoint(
      createWebsiteEndpoint({ connectorKey: '', endpointType: 'rss' }),
    );
    expect(withDefault.connectorKey).toBe('rss');
    expect(resolveConnectorKeyForEndpoint(withDefault)).toBe('rss');
  });

  it('suggests default connector key for endpoint type without runtime resolution', () => {
    expect(suggestConnectorKeyForEndpointType('website')).toBe('website');
    expect(suggestConnectorKeyForEndpointType('api')).toBe('api_json');
  });

  it('checks registry without instantiating connector', () => {
    const registry = new ConnectorRegistry();
    registry.register(createMockConnectorRegistration());

    const resolution = resolveEndpointConnector(
      registry,
      createWebsiteEndpoint({ connectorKey: 'mock' }),
    );
    expect(resolution.registrationFound).toBe(true);
    expect(resolution.connectorKey).toBe('mock');
  });
});

describe('Endpoint mapper', () => {
  it('maps endpoint to connector context ref', () => {
    const ref = mapEndpointToConnectorRef(createWebsiteEndpoint());
    expect(ref).toEqual({
      id: 'ep-website-1',
      label: 'Events page',
      url: 'https://example.com/events',
      endpointType: 'website',
    });
  });
});

describe('Website error mapping', () => {
  it('maps HTTP timeout to connector timeout category', () => {
    expect(mapHttpErrorToConnectorCategory('HTTP_TIMEOUT')).toBe('timeout');
  });

  it('maps website parse errors to parsing category', () => {
    const detail = mapWebsiteAcquisitionError({
      code: 'WEBSITE_PARSE',
      message: 'No event markup found.',
    });
    expect(detail.category).toBe('parsing');
  });

  it('maps HttpClientError to connector error detail', () => {
    const detail = mapHttpClientErrorToConnectorDetail(
      new HttpClientError({
        code: 'HTTP_NETWORK',
        message: 'Network unreachable',
        retryable: true,
      }),
    );
    expect(detail.category).toBe('connectivity');
    expect(detail.retryable).toBe(true);
  });
});
