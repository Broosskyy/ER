import type { SourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import type { SourceConnectorKey } from '@/features/aggregation/connectors/types';
import type {
  ConnectorHealthSnapshot,
  ConnectorHealthSnapshotRepository,
} from '../domain/operations-types';

function createSnapshotId(connectorKey: string): string {
  return `conn-health-${connectorKey}-${Date.now()}`;
}

export class ConnectorHealthPersistenceService {
  constructor(private readonly snapshotRepository: ConnectorHealthSnapshotRepository) {}

  async persistFromRegistry(
    registry: SourceConnectorRegistry,
    sourceId?: string,
    now = new Date(),
  ): Promise<ConnectorHealthSnapshot[]> {
    const snapshots: ConnectorHealthSnapshot[] = [];
    for (const descriptor of registry.listDescriptors()) {
      const snapshot = await this.snapshotRepository.upsert({
        id: createSnapshotId(descriptor.connectorKey),
        connectorKey: descriptor.connectorKey,
        sourceId,
        status: descriptor.health.status,
        successRate: descriptor.health.successRate,
        errorCount: descriptor.health.errorCount,
        totalRunCount: descriptor.health.totalRunCount,
        averageDurationMs: descriptor.health.averageDurationMs,
        lastResponseTimeMs: descriptor.health.lastResponseTimeMs,
        lastSuccessfulRunAt: descriptor.health.lastSuccessfulRunAt,
        lastErrorAt: descriptor.health.lastErrorAt,
        lastErrorCode: descriptor.health.lastErrorCode,
        lastErrorMessage: descriptor.health.lastErrorMessage,
        metadata: {
          metrics: descriptor.metrics,
        },
        computedAt: now.toISOString(),
      });
      snapshots.push(snapshot);
    }
    return snapshots;
  }

  async persistConnector(
    registry: SourceConnectorRegistry,
    connectorKey: SourceConnectorKey,
    sourceId?: string,
    now = new Date(),
  ): Promise<ConnectorHealthSnapshot> {
    const descriptor = registry.getDescriptor(connectorKey);
    return this.snapshotRepository.upsert({
      id: createSnapshotId(connectorKey),
      connectorKey,
      sourceId,
      status: descriptor.health.status,
      successRate: descriptor.health.successRate,
      errorCount: descriptor.health.errorCount,
      totalRunCount: descriptor.health.totalRunCount,
      averageDurationMs: descriptor.health.averageDurationMs,
      lastResponseTimeMs: descriptor.health.lastResponseTimeMs,
      lastSuccessfulRunAt: descriptor.health.lastSuccessfulRunAt,
      lastErrorAt: descriptor.health.lastErrorAt,
      lastErrorCode: descriptor.health.lastErrorCode,
      lastErrorMessage: descriptor.health.lastErrorMessage,
      metadata: { metrics: descriptor.metrics },
      computedAt: now.toISOString(),
    });
  }

  async listRecent(limit = 50): Promise<ConnectorHealthSnapshot[]> {
    return this.snapshotRepository.listRecent(limit);
  }

  async getLatestByConnectorKey(connectorKey: string): Promise<ConnectorHealthSnapshot | null> {
    return this.snapshotRepository.getLatestByConnectorKey(connectorKey);
  }
}
