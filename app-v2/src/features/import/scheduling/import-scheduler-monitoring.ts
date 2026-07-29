import type {
  ImportJobQueueRepository,
  ImportScheduleRepository,
  SchedulerRunRepository,
} from './import-schedule-types';

export interface SourceSchedulerStatus {
  sourceId: string;
  scheduleEnabled: boolean;
  schedulePolicy: string;
  scheduleIntervalPreset?: string;
  schedulerMaintenanceMode: boolean;
  nextScheduledAt?: string;
  lastScheduledAt?: string;
  lastSuccessfulImportAt?: string;
  lastFailedImportAt?: string;
  lastSchedulerError?: string;
  lastSchedulerErrorAt?: string;
  consecutiveFailures: number;
  backoffUntil?: string;
  currentlyRunning: boolean;
  queuedJobs: number;
}

export interface SchedulerMonitoringSnapshot {
  latestRuns: Awaited<ReturnType<SchedulerRunRepository['getLatest']>>;
  activeQueueDepth: number;
  dueSourceCount: number;
  sourcesInBackoff: number;
}

export class ImportSchedulerMonitoringService {
  constructor(
    private readonly scheduleRepository: ImportScheduleRepository,
    private readonly schedulerRunRepository: SchedulerRunRepository,
    private readonly queueRepository: ImportJobQueueRepository,
    private readonly hasActiveJob: (sourceId: string) => Promise<boolean>,
  ) {}

  async getSourceStatus(sourceId: string): Promise<SourceSchedulerStatus | null> {
    const state = await this.scheduleRepository.getState(sourceId);
    if (!state) {
      return null;
    }

    const queueEntries = await this.queueRepository.listBySourceId(sourceId, 50);
    const queuedJobs = queueEntries.filter((entry) => entry.status === 'queued').length;
    const currentlyRunning = await this.hasActiveJob(sourceId);

    return {
      sourceId,
      scheduleEnabled: state.scheduleEnabled,
      schedulePolicy: state.schedulePolicy,
      scheduleIntervalPreset: state.scheduleIntervalPreset,
      schedulerMaintenanceMode: state.schedulerMaintenanceMode ?? false,
      nextScheduledAt: state.nextScheduledAt,
      lastScheduledAt: state.lastScheduledAt,
      lastSuccessfulImportAt: state.lastSuccessfulImportAt,
      lastFailedImportAt: state.lastFailedImportAt,
      lastSchedulerError: state.lastSchedulerError,
      lastSchedulerErrorAt: state.lastSchedulerErrorAt,
      consecutiveFailures: state.consecutiveFailures,
      backoffUntil: state.backoffUntil,
      currentlyRunning,
      queuedJobs,
    };
  }

  async getSnapshot(now = new Date()): Promise<SchedulerMonitoringSnapshot> {
    const states = await this.scheduleRepository.listStates();
    const dueSourceCount = states.filter((state) => {
      if (!state.nextScheduledAt) return false;
      return new Date(state.nextScheduledAt).getTime() <= now.getTime();
    }).length;
    const sourcesInBackoff = states.filter((state) => {
      if (!state.backoffUntil) return false;
      return new Date(state.backoffUntil).getTime() > now.getTime();
    }).length;
    const queued = await this.queueRepository.listQueued(1000, now);

    return {
      latestRuns: await this.schedulerRunRepository.getLatest(10),
      activeQueueDepth: queued.length,
      dueSourceCount,
      sourcesInBackoff,
    };
  }

  async listScheduleStates() {
    return this.scheduleRepository.listStates();
  }
}
