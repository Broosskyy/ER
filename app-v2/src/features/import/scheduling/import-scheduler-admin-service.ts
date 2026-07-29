import type { AdminRole } from '@/features/import/admin/admin-roles';
import type { AdminSourceRepository } from '@/data/repositories/repositories';
import type { SourceService } from '@/features/sources/services/source-service';
import type { ScheduleIntervalPreset } from './schedule-interval-preset';
import { applyScheduleIntervalPresetToSource } from './source-schedule-mapper';
import { DefaultImportScheduleService } from './import-schedule-service';
import type { ImportScheduleRepository } from './import-schedule-types';
import { ImportSchedulerEngine } from './import-scheduler-engine';
import { ImportSchedulerMonitoringService } from './import-scheduler-monitoring';

export class ImportSchedulerAdminService {
  constructor(
    private readonly sourceService: SourceService,
    private readonly sourceRepository: AdminSourceRepository,
    private readonly scheduleRepository: ImportScheduleRepository,
    private readonly scheduleService: DefaultImportScheduleService,
    private readonly schedulerEngine: ImportSchedulerEngine,
    private readonly monitoringService: ImportSchedulerMonitoringService,
  ) {}

  async getSourceSchedulerStatus(role: AdminRole | null, sourceId: string) {
    await this.sourceService.getByIdForAdmin(role, sourceId);
    return this.monitoringService.getSourceStatus(sourceId);
  }

  async getMonitoringSnapshot() {
    return this.monitoringService.getSnapshot();
  }

  async updateSchedulePreset(
    role: AdminRole | null,
    sourceId: string,
    preset: ScheduleIntervalPreset,
  ) {
    const source = await this.sourceService.getByIdForAdmin(role, sourceId);
    if (!source) {
      throw new Error('Source not found.');
    }
    const updated = applyScheduleIntervalPresetToSource(source, preset);
    const saved = await this.sourceRepository.save(updated);
    const state = await this.scheduleRepository.getState(sourceId);
    if (state) {
      const next = this.scheduleService.applyIntervalPreset(state, preset, saved.pollingIntervalMinutes);
      next.nextScheduledAt =
        this.scheduleService.computeNextRun(next, new Date()) ?? new Date().toISOString();
      await this.scheduleRepository.saveState(next);
    }
    return saved;
  }

  async setMaintenanceMode(role: AdminRole | null, sourceId: string, enabled: boolean) {
    const source = await this.sourceService.getByIdForAdmin(role, sourceId);
    if (!source) {
      throw new Error('Source not found.');
    }
    const saved = await this.sourceRepository.save({
      ...source,
      schedulerMaintenanceMode: enabled,
      updatedAt: new Date().toISOString(),
    });
    const state = await this.scheduleRepository.getState(sourceId);
    if (state) {
      await this.scheduleRepository.saveState({
        ...state,
        schedulerMaintenanceMode: enabled,
      });
    }
    return saved;
  }

  async runSchedulerTick(actorId = 'admin-scheduler') {
    return this.schedulerEngine.tick({ actorId });
  }
}
