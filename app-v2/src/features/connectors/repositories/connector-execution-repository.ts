import type {
  ConnectorExecutionRecord,
  ConnectorExecutionResult,
} from '@/features/connectors/contracts/connector-execution';

export interface ConnectorExecutionRepository {
  saveStarted(record: ConnectorExecutionRecord): Promise<void>;
  saveCompleted(record: ConnectorExecutionRecord): Promise<void>;
  getById(executionId: string): Promise<ConnectorExecutionRecord | null>;
}

export class InMemoryConnectorExecutionRepository implements ConnectorExecutionRepository {
  private readonly records = new Map<string, ConnectorExecutionRecord>();

  async saveStarted(record: ConnectorExecutionRecord): Promise<void> {
    this.records.set(record.executionId, { ...record });
  }

  async saveCompleted(record: ConnectorExecutionRecord): Promise<void> {
    this.records.set(record.executionId, { ...record });
  }

  async getById(executionId: string): Promise<ConnectorExecutionRecord | null> {
    const record = this.records.get(executionId);
    return record ? { ...record } : null;
  }
}
