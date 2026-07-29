import type { SourceRecord } from '@/data/types/records';
import type { ScheduleIntervalPreset } from './schedule-interval-preset';
import { resolveScheduleIntervalPreset } from './schedule-interval-preset';
import type { ImportScheduleState } from './import-schedule-types';

export function mapSourceRecordToScheduleState(source: SourceRecord): ImportScheduleState {
  const preset = source.scheduleIntervalPreset ?? 'manual';
  const resolved = resolveScheduleIntervalPreset(preset, source.pollingIntervalMinutes);

  return {
    sourceId: source.id,
    scheduleEnabled: source.scheduleEnabled ?? resolved.scheduleEnabled,
    schedulePolicy: source.schedulePolicy ?? resolved.schedulePolicy,
    scheduleIntervalPreset: preset,
    schedulerMaintenanceMode: source.schedulerMaintenanceMode ?? false,
    pollingIntervalMinutes: source.pollingIntervalMinutes ?? resolved.pollingIntervalMinutes,
    timezone: source.scheduleTimezone ?? source.defaultTimezone ?? 'UTC',
    priority: source.priority,
    nextScheduledAt: source.nextScheduledAt,
    lastScheduledAt: source.lastScheduledAt,
    lastSuccessfulImportAt: source.lastSuccessfulSyncAt,
    lastFailedImportAt: source.lastFailedImportAt,
    consecutiveFailures: source.consecutiveFailureCount ?? 0,
    backoffUntil: source.backoffUntil,
    lastSchedulerError: source.lastError,
    lastSchedulerErrorAt: source.lastFailedImportAt,
  };
}

export function applyScheduleStateToSourceRecord(
  source: SourceRecord,
  state: ImportScheduleState,
): SourceRecord {
  return {
    ...source,
    scheduleEnabled: state.scheduleEnabled,
    schedulePolicy: state.schedulePolicy,
    scheduleIntervalPreset: state.scheduleIntervalPreset ?? source.scheduleIntervalPreset,
    schedulerMaintenanceMode: state.schedulerMaintenanceMode ?? source.schedulerMaintenanceMode,
    pollingIntervalMinutes: state.pollingIntervalMinutes ?? source.pollingIntervalMinutes,
    scheduleTimezone: state.timezone,
    nextScheduledAt: state.nextScheduledAt,
    lastScheduledAt: state.lastScheduledAt,
    lastSuccessfulSyncAt: state.lastSuccessfulImportAt ?? source.lastSuccessfulSyncAt,
    lastFailedImportAt: state.lastFailedImportAt ?? source.lastFailedImportAt,
    consecutiveFailureCount: state.consecutiveFailures,
    backoffUntil: state.backoffUntil,
    updatedAt: new Date().toISOString(),
  };
}

export function applyScheduleIntervalPresetToSource(
  source: SourceRecord,
  preset: ScheduleIntervalPreset,
): SourceRecord {
  const resolved = resolveScheduleIntervalPreset(preset, source.pollingIntervalMinutes);
  return {
    ...source,
    scheduleIntervalPreset: preset,
    scheduleEnabled: resolved.scheduleEnabled,
    schedulePolicy: resolved.schedulePolicy,
    pollingIntervalMinutes: resolved.pollingIntervalMinutes ?? source.pollingIntervalMinutes,
    updatedAt: new Date().toISOString(),
  };
}
