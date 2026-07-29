import type {
  ImportScheduleDueSource,
  ImportScheduleLock,
  ImportScheduleRepository,
  ImportScheduleService,
  ImportScheduleState,
} from './import-schedule-types';
import {
  resolveScheduleIntervalPreset,
  type ScheduleIntervalPreset,
} from './schedule-interval-preset';

const DEFAULT_BACKOFF_MINUTES = [15, 30, 60, 120, 240];

function addMinutes(iso: string | Date, minutes: number): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

export class DefaultImportScheduleService implements ImportScheduleService {
  constructor(private readonly repository: ImportScheduleRepository) {}

  async listDueSources(now: Date): Promise<ImportScheduleDueSource[]> {
    const states = await this.repository.listStates();
    const due: ImportScheduleDueSource[] = [];

    for (const state of states) {
      const skip = this.shouldSkip(state, now);
      if (skip.skip) {
        continue;
      }
      if (!state.nextScheduledAt) {
        continue;
      }
      if (new Date(state.nextScheduledAt).getTime() <= now.getTime()) {
        due.push({
          sourceId: state.sourceId,
          dueAt: state.nextScheduledAt,
          reason: state.schedulePolicy === 'manual_only' ? 'manual_retry' : 'interval_due',
        });
      }
    }

    return due.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  }

  computeNextRun(state: ImportScheduleState, now: Date): string | undefined {
    if (!state.scheduleEnabled || state.schedulePolicy === 'manual_only' || state.schedulePolicy === 'paused') {
      return undefined;
    }
    if (state.schedulePolicy === 'interval' && state.pollingIntervalMinutes) {
      return addMinutes(now, state.pollingIntervalMinutes);
    }
    return state.nextScheduledAt;
  }

  shouldSkip(state: ImportScheduleState, now: Date): { skip: boolean; reason?: string } {
    if (state.schedulerMaintenanceMode) {
      return { skip: true, reason: 'maintenance_mode' };
    }
    if (!state.scheduleEnabled) {
      return { skip: true, reason: 'disabled' };
    }
    if (state.schedulePolicy === 'paused') {
      return { skip: true, reason: 'paused' };
    }
    if (state.schedulePolicy === 'manual_only') {
      return { skip: true, reason: 'manual_only' };
    }
    if (state.backoffUntil && new Date(state.backoffUntil).getTime() > now.getTime()) {
      return { skip: true, reason: 'backoff_active' };
    }
    return { skip: false };
  }

  async recordSuccess(sourceId: string, completedAt: Date): Promise<ImportScheduleState> {
    const current = await this.requireState(sourceId);
    const next: ImportScheduleState = {
      ...current,
      consecutiveFailures: 0,
      backoffUntil: undefined,
      lastSuccessfulImportAt: completedAt.toISOString(),
      lastScheduledAt: completedAt.toISOString(),
      lastSchedulerError: undefined,
      lastSchedulerErrorAt: undefined,
      nextScheduledAt: this.computeNextRun(current, completedAt),
    };
    await this.repository.saveState(next);
    return next;
  }

  async recordFailure(sourceId: string, failedAt: Date, errorMessage: string): Promise<ImportScheduleState> {
    const current = await this.requireState(sourceId);
    const failures = current.consecutiveFailures + 1;
    const backoffIndex = Math.min(failures - 1, DEFAULT_BACKOFF_MINUTES.length - 1);
    const backoffMinutes = DEFAULT_BACKOFF_MINUTES[backoffIndex] ?? 240;
    const next: ImportScheduleState = {
      ...current,
      consecutiveFailures: failures,
      lastFailedImportAt: failedAt.toISOString(),
      lastScheduledAt: failedAt.toISOString(),
      lastSchedulerError: errorMessage,
      lastSchedulerErrorAt: failedAt.toISOString(),
      backoffUntil: addMinutes(failedAt, backoffMinutes),
      nextScheduledAt: addMinutes(failedAt, backoffMinutes),
    };
    await this.repository.saveState(next);
    return next;
  }

  applyIntervalPreset(
    state: ImportScheduleState,
    preset: ScheduleIntervalPreset,
    customIntervalMinutes?: number,
  ): ImportScheduleState {
    const resolved = resolveScheduleIntervalPreset(preset, customIntervalMinutes);
    return {
      ...state,
      scheduleIntervalPreset: preset,
      scheduleEnabled: resolved.scheduleEnabled,
      schedulePolicy: resolved.schedulePolicy,
      pollingIntervalMinutes: resolved.pollingIntervalMinutes ?? state.pollingIntervalMinutes,
    };
  }

  private async requireState(sourceId: string): Promise<ImportScheduleState> {
    const state = await this.repository.getState(sourceId);
    if (!state) {
      throw new Error(`Import schedule state not found for source ${sourceId}`);
    }
    return state;
  }
}

export class InMemoryImportScheduleRepository implements ImportScheduleRepository {
  private readonly states = new Map<string, ImportScheduleState>();
  private readonly locks = new Map<string, ImportScheduleLock>();

  async getState(sourceId: string): Promise<ImportScheduleState | null> {
    return this.states.get(sourceId) ?? null;
  }

  async listStates(): Promise<ImportScheduleState[]> {
    return [...this.states.values()];
  }

  async saveState(state: ImportScheduleState): Promise<void> {
    this.states.set(state.sourceId, state);
  }

  async tryAcquireLock(sourceId: string, leaseId: string, expiresAt: string): Promise<boolean> {
    const existing = this.locks.get(sourceId);
    if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
      return false;
    }
    this.locks.set(sourceId, {
      sourceId,
      leaseId,
      acquiredAt: new Date().toISOString(),
      expiresAt,
    });
    return true;
  }

  async releaseLock(sourceId: string, leaseId: string): Promise<void> {
    const existing = this.locks.get(sourceId);
    if (existing?.leaseId === leaseId) {
      this.locks.delete(sourceId);
    }
  }

  async releaseExpiredLocks(now = new Date()): Promise<number> {
    let released = 0;
    for (const [sourceId, lock] of this.locks.entries()) {
      if (new Date(lock.expiresAt).getTime() <= now.getTime()) {
        this.locks.delete(sourceId);
        released += 1;
      }
    }
    return released;
  }
}
