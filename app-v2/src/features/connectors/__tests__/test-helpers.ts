import type { SourceRecord } from '@/data/types/records';
import { BaseConnector } from '@/features/connectors/base/base-connector';
import type { ConnectorContext } from '@/features/connectors/contracts/connector-context';
import type { ConnectorResult } from '@/features/connectors/contracts/connector-result';
import type { ConnectorValidationResult } from '@/features/connectors/contracts/connector';
import { createConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';

export const MOCK_CONNECTOR_KEY = 'mock';

export function createTestSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const now = new Date().toISOString();
  return {
    id: 'src-test',
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTestConnectorContext(
  overrides: Partial<ConnectorContext> = {},
): ConnectorContext {
  const source = overrides.source ?? createTestSourceRecord();
  return {
    source,
    execution: overrides.execution ?? {
      executionId: 'exec-test-1',
      startedAt: new Date().toISOString(),
      triggerType: 'manual',
    },
    log: overrides.log ?? (async () => {}),
    ...overrides,
  };
}

export class MockConnector extends BaseConnector {
  readonly connectorKey = MOCK_CONNECTOR_KEY;
  readonly displayName = 'Mock Connector';
  readonly capabilities = createConnectorCapabilities({
    supportsPolling: true,
  });

  validateConfiguration(_context: ConnectorContext): ConnectorValidationResult {
    return { valid: true, issues: [] };
  }

  async execute(context: ConnectorContext): Promise<ConnectorResult> {
    const started = Date.now();
    await context.log('info', 'MOCK_EXECUTE', 'Mock connector executed.');
    return this.createSuccessResult(
      {
        candidates: [
          {
            externalId: 'mock-candidate-1',
            sourceUrl: context.source.baseUrl,
            rawPayload: { title: 'Mock Event' },
            normalizedPayload: { title: 'Mock Event', startDate: '2026-08-01T20:00:00Z' },
            metadata: {
              endpointId: context.endpoint?.id,
              sourceId: context.source.id,
              retrievedAt: new Date().toISOString(),
            },
          },
        ],
        metadata: { connector: MOCK_CONNECTOR_KEY },
      },
      Date.now() - started,
    );
  }
}

export function createMockConnectorRegistration() {
  return {
    connectorKey: MOCK_CONNECTOR_KEY,
    displayName: 'Mock Connector',
    capabilities: createConnectorCapabilities({ supportsPolling: true }),
    create: () => new MockConnector(),
  };
}
