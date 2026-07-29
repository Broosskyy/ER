import type { ImportSchedulePolicy } from './import-schedule-types';

export const SCHEDULE_INTERVAL_PRESETS = [
  'disabled',
  'manual',
  'every_15_minutes',
  'every_30_minutes',
  'hourly',
  'every_6_hours',
  'daily',
  'custom',
] as const;

export type ScheduleIntervalPreset = (typeof SCHEDULE_INTERVAL_PRESETS)[number];

const PRESET_INTERVAL_MINUTES: Record<Exclude<ScheduleIntervalPreset, 'custom' | 'manual' | 'disabled'>, number> = {
  every_15_minutes: 15,
  every_30_minutes: 30,
  hourly: 60,
  every_6_hours: 360,
  daily: 1440,
};

export interface ResolvedSchedulePreset {
  scheduleEnabled: boolean;
  schedulePolicy: ImportSchedulePolicy;
  pollingIntervalMinutes?: number;
}

export function resolveScheduleIntervalPreset(
  preset: ScheduleIntervalPreset,
  customIntervalMinutes?: number,
): ResolvedSchedulePreset {
  switch (preset) {
    case 'disabled':
      return { scheduleEnabled: false, schedulePolicy: 'paused' };
    case 'manual':
      return { scheduleEnabled: true, schedulePolicy: 'manual_only' };
    case 'custom':
      return {
        scheduleEnabled: true,
        schedulePolicy: 'interval',
        pollingIntervalMinutes: customIntervalMinutes && customIntervalMinutes > 0 ? customIntervalMinutes : 60,
      };
    default:
      return {
        scheduleEnabled: true,
        schedulePolicy: 'interval',
        pollingIntervalMinutes: PRESET_INTERVAL_MINUTES[preset],
      };
  }
}

export function formatScheduleIntervalPresetLabel(preset: ScheduleIntervalPreset): string {
  switch (preset) {
    case 'disabled':
      return 'Deaktiviert';
    case 'manual':
      return 'Manuell';
    case 'every_15_minutes':
      return 'Alle 15 Minuten';
    case 'every_30_minutes':
      return 'Alle 30 Minuten';
    case 'hourly':
      return 'Stündlich';
    case 'every_6_hours':
      return 'Alle 6 Stunden';
    case 'daily':
      return 'Täglich';
    case 'custom':
      return 'Benutzerdefiniert';
    default:
      return preset;
  }
}
