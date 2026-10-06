import type { IngestionRunRecord, SourceHealthRecord } from './types';

export interface IngestionSyncPersistence {
  createRun(record: IngestionRunRecord): Promise<void>;
  completeRun(runId: string, update: Partial<IngestionRunRecord>): Promise<void>;
  getRun(runId: string): Promise<IngestionRunRecord | undefined>;
  getActiveRun(connectorId: string): Promise<IngestionRunRecord | undefined>;
  upsertHealth(health: SourceHealthRecord): Promise<void>;
  getHealth(connectorId: string): Promise<SourceHealthRecord | undefined>;
  listRunsForConnector(connectorId: string): Promise<IngestionRunRecord[]>;
}

export class InMemoryIngestionSyncPersistence implements IngestionSyncPersistence {
  private readonly runs = new Map<string, IngestionRunRecord>();
  private readonly health = new Map<string, SourceHealthRecord>();

  async createRun(record: IngestionRunRecord): Promise<void> {
    this.runs.set(record.runId, { ...record });
  }

  async completeRun(runId: string, update: Partial<IngestionRunRecord>): Promise<void> {
    const existing = this.runs.get(runId);
    if (!existing) {
      throw new Error(`ingestion_run_not_found:${runId}`);
    }
    this.runs.set(runId, { ...existing, ...update });
  }

  async getRun(runId: string): Promise<IngestionRunRecord | undefined> {
    const record = this.runs.get(runId);
    return record ? { ...record } : undefined;
  }

  async getActiveRun(connectorId: string): Promise<IngestionRunRecord | undefined> {
    const active = [...this.runs.values()].find(
      (run) => run.connectorId === connectorId && run.status === 'running',
    );
    return active ? { ...active } : undefined;
  }

  async upsertHealth(record: SourceHealthRecord): Promise<void> {
    this.health.set(record.connectorId, { ...record });
  }

  async getHealth(connectorId: string): Promise<SourceHealthRecord | undefined> {
    const record = this.health.get(connectorId);
    return record ? { ...record } : undefined;
  }

  async listRunsForConnector(connectorId: string): Promise<IngestionRunRecord[]> {
    return [...this.runs.values()]
      .filter((run) => run.connectorId === connectorId)
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }
}

export function createInMemoryIngestionSyncPersistence(): InMemoryIngestionSyncPersistence {
  return new InMemoryIngestionSyncPersistence();
}
