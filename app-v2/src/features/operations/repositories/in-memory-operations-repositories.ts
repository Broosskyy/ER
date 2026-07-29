import type {
  ConnectorHealthSnapshot,
  ConnectorHealthSnapshotRepository,
  OperationsBackfillJob,
  OperationsBackfillJobRepository,
  PlatformOperationsState,
  PlatformOperationsStateRepository,
  SourceIntelligenceSnapshot,
  SourceIntelligenceSnapshotRepository,
  WorkerRecoveryRun,
  WorkerRecoveryRunRepository,
} from '../domain/operations-types';

const DEFAULT_STATE: PlatformOperationsState = {
  id: 'default',
  workerPaused: false,
  schedulerPaused: false,
  globalMaintenanceMode: false,
  metadata: {},
  updatedAt: new Date().toISOString(),
};

export class InMemoryPlatformOperationsStateRepository implements PlatformOperationsStateRepository {
  private state: PlatformOperationsState = { ...DEFAULT_STATE };

  async get(): Promise<PlatformOperationsState> {
    return { ...this.state };
  }

  async save(state: PlatformOperationsState): Promise<PlatformOperationsState> {
    this.state = { ...state };
    return this.state;
  }
}

export class InMemoryOperationsBackfillJobRepository implements OperationsBackfillJobRepository {
  private readonly jobs = new Map<string, OperationsBackfillJob>();

  async create(job: OperationsBackfillJob): Promise<OperationsBackfillJob> {
    this.jobs.set(job.id, { ...job });
    return job;
  }

  async update(job: OperationsBackfillJob): Promise<OperationsBackfillJob> {
    this.jobs.set(job.id, { ...job });
    return job;
  }

  async findById(id: string): Promise<OperationsBackfillJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async findActiveByType(
    backfillType: OperationsBackfillJob['backfillType'],
  ): Promise<OperationsBackfillJob | null> {
    return (
      [...this.jobs.values()].find(
        (job) => job.backfillType === backfillType && ['pending', 'running'].includes(job.status),
      ) ?? null
    );
  }

  async listRecent(limit = 20): Promise<OperationsBackfillJob[]> {
    return [...this.jobs.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }
}

export class InMemorySourceIntelligenceSnapshotRepository
  implements SourceIntelligenceSnapshotRepository
{
  private readonly snapshots: SourceIntelligenceSnapshot[] = [];

  async upsert(snapshot: SourceIntelligenceSnapshot): Promise<SourceIntelligenceSnapshot> {
    this.snapshots.push({ ...snapshot });
    return snapshot;
  }

  async getLatestBySourceId(sourceId: string): Promise<SourceIntelligenceSnapshot | null> {
    return (
      [...this.snapshots]
        .filter((entry) => entry.sourceId === sourceId)
        .sort((left, right) => right.computedAt.localeCompare(left.computedAt))[0] ?? null
    );
  }

  async listBySourceId(sourceId: string, limit = 20): Promise<SourceIntelligenceSnapshot[]> {
    return this.snapshots
      .filter((entry) => entry.sourceId === sourceId)
      .sort((left, right) => right.computedAt.localeCompare(left.computedAt))
      .slice(0, limit);
  }

  async listRecent(limit = 50): Promise<SourceIntelligenceSnapshot[]> {
    return [...this.snapshots]
      .sort((left, right) => right.computedAt.localeCompare(left.computedAt))
      .slice(0, limit);
  }
}

export class InMemoryConnectorHealthSnapshotRepository implements ConnectorHealthSnapshotRepository {
  private readonly snapshots: ConnectorHealthSnapshot[] = [];

  async upsert(snapshot: ConnectorHealthSnapshot): Promise<ConnectorHealthSnapshot> {
    this.snapshots.push({ ...snapshot });
    return snapshot;
  }

  async getLatestByConnectorKey(connectorKey: string): Promise<ConnectorHealthSnapshot | null> {
    return (
      [...this.snapshots]
        .filter((entry) => entry.connectorKey === connectorKey)
        .sort((left, right) => right.computedAt.localeCompare(left.computedAt))[0] ?? null
    );
  }

  async listRecent(limit = 50): Promise<ConnectorHealthSnapshot[]> {
    return [...this.snapshots]
      .sort((left, right) => right.computedAt.localeCompare(left.computedAt))
      .slice(0, limit);
  }
}

export class InMemoryWorkerRecoveryRunRepository implements WorkerRecoveryRunRepository {
  private readonly runs: WorkerRecoveryRun[] = [];

  async create(run: WorkerRecoveryRun): Promise<WorkerRecoveryRun> {
    this.runs.push({ ...run });
    return run;
  }

  async update(run: WorkerRecoveryRun): Promise<WorkerRecoveryRun> {
    const index = this.runs.findIndex((entry) => entry.id === run.id);
    if (index >= 0) {
      this.runs[index] = { ...run };
    } else {
      this.runs.push({ ...run });
    }
    return run;
  }

  async getLatest(limit = 20): Promise<WorkerRecoveryRun[]> {
    return [...this.runs]
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, limit);
  }
}
