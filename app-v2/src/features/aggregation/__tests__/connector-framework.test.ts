import { afterEach, describe, expect, it } from 'vitest';

import { ManualReferenceConnector } from '@/features/aggregation/connectors/manual-reference-connector';
import { OpenDataApiConnector } from '@/features/aggregation/connectors/open-data-api-connector';
import { createDefaultSourceConnectorRegistry, SourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { SOURCE_CONNECTOR_KEYS } from '@/features/aggregation/connectors/types';
import {
  SOURCE_CONNECTOR_DEFINITIONS,
  SOURCE_CONNECTOR_ERROR_CODES,
  SOURCE_CONNECTOR_HEALTH_STATUSES,
  SourceConnectorError,
  SourceConnectorExecutor,
  SourceConnectorRateLimiter,
  classifySourceConnectorError,
  createSourceConnectorCapabilities,
  createSourceConnectorVersion,
  isRegistryVersionCompatible,
  isRetryableSourceConnectorError,
  resolveSourceConnectorRetry,
} from '@/features/aggregation/connectors/framework';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { ImportExecutionError } from '@/features/import/errors/import-errors';
import type { SourceRecord } from '@/data/types/records';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import { BaseSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: 'source-test',
    slug: 'test-source',
    displayName: 'Test Source',
    sourceType: 'manual',
    parserType: 'unknown',
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore: 50,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    reviewRequired: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

const context: PipelineRunContext = {
  runId: 'run-test',
  source: mapSourceRecordToAggregationSource(source()),
  triggerType: 'manual',
  startedAt: new Date().toISOString(),
};

describe('connector framework capabilities', () => {
  it('exposes the same capability structure for every connector', () => {
    const registry = createDefaultSourceConnectorRegistry();
    const descriptors = registry.listDescriptors();

    expect(descriptors).toHaveLength(SOURCE_CONNECTOR_KEYS.length);

    for (const descriptor of descriptors) {
      expect(descriptor.capabilities).toEqual(
        expect.objectContaining({
          supportsPagination: expect.any(Boolean),
          supportsDeltaImports: expect.any(Boolean),
          supportsImages: expect.any(Boolean),
          supportsArtists: expect.any(Boolean),
          supportsVenueCoordinates: expect.any(Boolean),
          supportsGenres: expect.any(Boolean),
          supportsTicketLinks: expect.any(Boolean),
          supportsTimezone: expect.any(Boolean),
          supportsWebhooks: expect.any(Boolean),
          supportsRateLimits: expect.any(Boolean),
          supportsAuthentication: expect.any(Boolean),
        }),
      );
    }
  });

  it('loads open_data_api capabilities for partner feeds', () => {
    const connector = new OpenDataApiConnector();
    expect(connector.describeCapabilities()).toMatchObject({
      supportsPagination: true,
      supportsAuthentication: true,
      supportsArtists: true,
      supportsGenres: true,
    });
  });
});

describe('connector framework versioning', () => {
  it('keeps registry compatibility for existing connectors', () => {
    const version = createSourceConnectorVersion({ connectorVersion: '1.0.0' });
    expect(isRegistryVersionCompatible(version)).toBe(true);
  });

  it('registers connector and schema versions on descriptors', () => {
    const registry = createDefaultSourceConnectorRegistry();
    const descriptor = registry.getDescriptor('open_data_api');

    expect(descriptor.version.connectorVersion).toBe('1.1.0');
    expect(descriptor.version.schemaVersion).toBe('1.0.0');
    expect(descriptor.version.supportedApiVersions).toContain('partner-v1');
  });
});

describe('connector framework retry', () => {
  it('retries transient network failures with exponential backoff', () => {
    const decision = resolveSourceConnectorRetry(
      classifySourceConnectorError(new ImportExecutionError('network reset', 'IMPORT_EXECUTION_FAILED')),
      1,
      { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 1_000 },
      1_000,
    );

    expect(decision.retryable).toBe(true);
    expect(decision.delayMs).toBeGreaterThanOrEqual(100);
  });

  it('does not retry configuration or mapping failures', () => {
    expect(
      isRetryableSourceConnectorError('configuration_invalid'),
    ).toBe(false);
    expect(
      resolveSourceConnectorRetry(
        classifySourceConnectorError(new ImportExecutionError('HTTP 400 bad request', 'IMPORT_EXECUTION_FAILED')),
        1,
        { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 1_000 },
      ).retryable,
    ).toBe(false);
  });

  it('retries connector execution through the executor', async () => {
    let attempts = 0;
    class FlakyConnector extends BaseSourceConnector {
      readonly connectorKey = 'manual_reference' as const;
      protected readonly definition = SOURCE_CONNECTOR_DEFINITIONS.manual_reference;

      getRetryConfig() {
        return { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 };
      }

      async fetchRawEvents() {
        attempts += 1;
        if (attempts < 2) {
          throw new ImportExecutionError('HTTP 503 upstream unavailable', 'IMPORT_EXECUTION_FAILED');
        }
        return [{
          externalId: 'x-1',
          importId: 'x-1',
          rawSourceType: 'unknown' as const,
          title: 'Retry Event',
          startDate: '2026-08-01T20:00:00.000Z',
        }];
      }
    }

    const limiter = new SourceConnectorRateLimiter();
    const executor = new SourceConnectorExecutor(limiter);
    const record = source({ sourceType: 'manual' });

    const result = await executor.execute(
      new FlakyConnector(),
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );

    expect(attempts).toBe(2);
    expect(result.events).toHaveLength(1);
    expect(result.diagnostics.retryAttempts).toBe(1);
    expect(result.retryMetadata).toHaveLength(1);
  });
});

describe('connector framework rate limiting', () => {
  afterEach(() => {
    new SourceConnectorRateLimiter().reset();
  });

  it('enforces burst limits before execution', async () => {
    const limiter = new SourceConnectorRateLimiter();
    const config = {
      requestsPerMinute: 2,
      burstLimit: 1,
      cooldownMs: 10,
      concurrentRequests: 2,
    };

    const first = await limiter.acquire('manual_reference', config);
    limiter.release('manual_reference');
    const second = await limiter.acquire('manual_reference', config);
    limiter.release('manual_reference');

    expect(first.rateLimited).toBe(false);
    expect(second.rateLimited).toBe(true);
  });
});

describe('connector framework diagnostics and metrics', () => {
  it('records structured diagnostics after execution', async () => {
    const registry = createDefaultSourceConnectorRegistry();
    const executor = registry.getExecutor();
    const record = source({ sourceType: 'manual' });

    const result = await executor.execute(
      registry.get('manual_reference'),
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );

    expect(result.diagnostics.connectorVersion).toBe('1.0.0');
    expect(result.diagnostics.eventCount).toBeGreaterThan(0);
    expect(result.diagnostics.durationMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.diagnostics.errors)).toBe(true);
    expect(Array.isArray(result.diagnostics.mappingIssues)).toBe(true);
  });

  it('updates registry health and metrics after successful runs', async () => {
    const registry = createDefaultSourceConnectorRegistry();
    const executor = registry.getExecutor();
    const record = source({ sourceType: 'manual' });

    await executor.execute(
      registry.get('manual_reference'),
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );

    const health = registry.getHealth('manual_reference');
    const metrics = registry.getMetrics('manual_reference');

    expect(SOURCE_CONNECTOR_HEALTH_STATUSES).toContain(health.status);
    expect(health.totalRunCount).toBe(1);
    expect(health.lastSuccessfulRunAt).toBeTruthy();
    expect(metrics.importedEvents).toBeGreaterThan(0);
    expect(metrics.totalRuns).toBe(1);
  });
});

describe('connector framework registry integration', () => {
  it('lists descriptors with retry and rate limit config', () => {
    const registry = createDefaultSourceConnectorRegistry();
    const descriptor = registry.getDescriptor('open_data_api');

    expect(descriptor.retryConfig.maxRetries).toBeGreaterThan(0);
    expect(descriptor.rateLimitConfig.requestsPerMinute).toBeGreaterThan(0);
    expect(descriptor.limitations.length).toBeGreaterThan(0);
  });

  it('applies per-source retry overrides', () => {
    const connector = new ManualReferenceConnector();
    const importSource = mapSourceRecordToImportSource(
      source({
        sourceConfig: {
          connectorFramework: {
            retry: { maxRetries: 5 },
          },
        },
      }),
    );

    expect(connector.getRetryConfig(importSource).maxRetries).toBe(5);
  });
});

describe('connector framework error classes', () => {
  it('classifies timeout, auth, and rate limit errors', () => {
    expect(classifySourceConnectorError(new ImportExecutionError('Fetch request timed out.', 'IMPORT_TIMEOUT')).code).toBe('timeout');
    expect(classifySourceConnectorError(new ImportExecutionError('HTTP 401 for https://example.com', 'IMPORT_EXECUTION_FAILED')).code).toBe('authentication_failed');
    expect(classifySourceConnectorError(new ImportExecutionError('HTTP 429 rate limit', 'IMPORT_EXECUTION_FAILED')).code).toBe('rate_limited');
  });

  it('exposes typed connector errors with retry metadata', () => {
    const detail = classifySourceConnectorError(new ImportExecutionError('HTTP 503', 'IMPORT_EXECUTION_FAILED'));
    const error = new SourceConnectorError(detail);

    expect(SOURCE_CONNECTOR_ERROR_CODES).toContain(error.code);
    expect(error.retryable).toBe(true);
    expect(error).toBeInstanceOf(SourceConnectorError);
  });

  it('maps health status from error codes', async () => {
    class FailingConnector extends BaseSourceConnector {
      readonly connectorKey = 'club_website' as const;
      protected readonly definition = SOURCE_CONNECTOR_DEFINITIONS.club_website;

      async fetchRawEvents(): Promise<never> {
        throw new ImportExecutionError('HTTP 401 unauthorized', 'IMPORT_EXECUTION_FAILED');
      }
    }

    const registry = new SourceConnectorRegistry([new FailingConnector()]);
    const executor = registry.getExecutor();
    const record = source({ sourceType: 'website', parserType: 'json-ld' });

    await expect(
      executor.execute(
        registry.get('club_website'),
        mapSourceRecordToAggregationSource(record),
        mapSourceRecordToImportSource(record),
        context,
      ),
    ).rejects.toBeInstanceOf(SourceConnectorError);

    expect(registry.getHealth('club_website').status).toBe('unauthorized');
  });
});

describe('connector framework timeout handling', () => {
  it('classifies abort errors as timeout without retrying past the limit', async () => {
    const decision = resolveSourceConnectorRetry(
      classifySourceConnectorError(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
      4,
      { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 1_000 },
    );

    expect(decision.retryable).toBe(false);
  });
});

describe('createSourceConnectorCapabilities', () => {
  it('fills defaults for partial overrides', () => {
    expect(createSourceConnectorCapabilities({ supportsImages: true }).supportsPagination).toBe(false);
    expect(createSourceConnectorCapabilities({ supportsImages: true }).supportsImages).toBe(true);
  });
});

describe('existing connectors remain compatible', () => {
  it('still loads club website events through the instrumented registry path', async () => {
    const registry = createDefaultSourceConnectorRegistry();
    const executor = registry.getExecutor();
    const record = source({ sourceType: 'website', parserType: 'json-ld' });

    const result = await executor.execute(
      registry.get('club_website'),
      mapSourceRecordToAggregationSource(record),
      mapSourceRecordToImportSource(record),
      context,
    );

    expect(result.events.some((event) => event.title?.includes('Club Night'))).toBe(true);
  });
});
