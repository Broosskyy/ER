import { AppError } from '@/core/errors/app-error';
import type { ImportAdapterRegistry } from '@/features/import/adapters/import-adapter-registry';
import {
  ImportError,
  ImportPermissionError,
} from '@/features/import/errors/import-errors';
import { importConfig } from '@/features/import/config/import-config';
import type { ImportSourceConfig } from '@/features/import/models/source-config';
import type {
  ImportJob,
  ImportSource,
  SourceTestResult,
} from '@/features/import/models/types';
import type { ImportOrchestrator } from '@/features/import/services/import-orchestrator';
import type { AuthSession } from '@/services/supabase/auth-service';
import type { ImportAdminRepository } from '@/data/repositories/import-admin-repository';
import type {
  ImportJobRepository,
  ImportSourceRepository,
} from '@/data/repositories/import-repositories';
import {
  assertPermission,
  resolveAdminRole,
  type AdminRole,
} from '@/features/import/admin/admin-roles';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { SourceService } from '@/features/sources/services/source-service';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { ImportAuditService } from './import-audit-service';

const ADAPTER_KEYS = ['json_ld', 'rss', 'atom', 'ical', 'csv', 'api_json'] as const;

export function validateSourceConfig(
  adapterKey: string,
  config: ImportSourceConfig | undefined,
): string[] {
  const errors: string[] = [];
  if (!ADAPTER_KEYS.includes(adapterKey as (typeof ADAPTER_KEYS)[number])) {
    errors.push('Invalid adapter key.');
    return errors;
  }

  switch (adapterKey) {
    case 'json_ld':
      if (!config?.jsonLd?.pageUrl && !config?.feed?.feedUrl) {
        errors.push('JSON-LD source requires pageUrl or feedUrl.');
      }
      break;
    case 'rss':
    case 'atom':
      if (!config?.feed?.feedUrl) {
        errors.push('Feed source requires feedUrl.');
      }
      break;
    case 'ical':
    case 'csv':
    case 'api_json':
      if (!config?.feed?.feedUrl && !config?.api) {
        errors.push('Source requires a URL configuration.');
      }
      if (adapterKey === 'csv' && !config?.csv?.fieldMapping) {
        errors.push('CSV source requires fieldMapping.');
      }
      if (adapterKey === 'api_json' && !config?.api?.fieldMapping) {
        errors.push('API JSON source requires fieldMapping.');
      }
      break;
  }

  return errors;
}

function mapSourceServiceError(error: unknown): never {
  if (error instanceof AppError) {
    if (error.code === 'UNAUTHORIZED') {
      throw new ImportPermissionError();
    }
    if (error.code === 'NOT_FOUND') {
      throw new ImportError(error.message, 'IMPORT_SOURCE_NOT_FOUND');
    }
    if (error.code === 'VALIDATION') {
      throw new ImportError(error.message, 'IMPORT_VALIDATION_BLOCKED');
    }
  }
  throw error;
}

export class ImportOperationsService {
  constructor(
    private readonly sourceRepository: ImportSourceRepository,
    private readonly sourceService: SourceService,
    private readonly jobRepository: ImportJobRepository,
    private readonly adminRepository: ImportAdminRepository,
    private readonly orchestrator: ImportOrchestrator,
    private readonly adapterRegistry: ImportAdapterRegistry,
    private readonly auditService: ImportAuditService,
    private readonly aggregationService?: ImportAggregationService,
  ) {}

  private role(session: AuthSession | null): AdminRole | null {
    return resolveAdminRole(session);
  }

  private actorId(session: AuthSession): string {
    return session.user.id;
  }

  async listSources(session: AuthSession | null): Promise<ImportSource[]> {
    assertPermission(this.role(session), 'sources:read');
    return this.sourceRepository.getAll();
  }

  async getSource(session: AuthSession | null, id: string): Promise<ImportSource | null> {
    assertPermission(this.role(session), 'sources:read');
    return this.sourceRepository.getById(id);
  }

  async saveSource(
    session: AuthSession,
    source: ImportSource,
    isNew: boolean,
  ): Promise<ImportSource> {
    assertPermission(this.role(session), 'sources:write');
    const configErrors = validateSourceConfig(source.adapterKey ?? '', source.sourceConfig);
    if (configErrors.length > 0) {
      throw new ImportError(configErrors.join(' '), 'IMPORT_ADAPTER_INVALID');
    }

    const role = this.role(session);
    try {
      const record = await this.sourceService.saveFromImportSource(role, source, isNew);
      const saved = mapSourceRecordToImportSource(record);
      if (isNew) {
        await this.auditService.logSourceCreated(this.actorId(session), saved.id, saved.name);
      } else {
        await this.auditService.logSourceUpdated(
          this.actorId(session),
          saved.id,
          `Source "${saved.name}" updated.`,
        );
      }
      return saved;
    } catch (error) {
      mapSourceServiceError(error);
    }
  }

  async setSourceActive(
    session: AuthSession,
    sourceId: string,
    active: boolean,
  ): Promise<ImportSource> {
    assertPermission(this.role(session), 'sources:write');
    const role = this.role(session);
    try {
      const record = await this.sourceService.setEnabled(role, sourceId, active);
      const updated = mapSourceRecordToImportSource(record);
      if (active) {
        await this.auditService.logSourceActivated(this.actorId(session), sourceId);
      } else {
        await this.auditService.logSourceDeactivated(this.actorId(session), sourceId);
      }
      return updated;
    } catch (error) {
      mapSourceServiceError(error);
    }
  }

  async testSource(session: AuthSession, sourceId: string): Promise<SourceTestResult> {
    assertPermission(this.role(session), 'sources:test');
    const started = Date.now();
    const source = await this.sourceRepository.getById(sourceId);
    if (!source) {
      throw new ImportError('Source not found.', 'IMPORT_SOURCE_NOT_FOUND');
    }

    const configErrors = validateSourceConfig(source.adapterKey ?? '', source.sourceConfig);
    if (configErrors.length > 0) {
      return {
        success: false,
        status: 'failed',
        durationMs: Date.now() - started,
        recordCount: 0,
        warnings: [],
        errors: configErrors,
        sampleRecords: [],
      };
    }

    if (!source.adapterKey) {
      return {
        success: false,
        status: 'failed',
        durationMs: Date.now() - started,
        recordCount: 0,
        warnings: [],
        errors: ['No adapter configured.'],
        sampleRecords: [],
      };
    }

    try {
      const adapter = this.adapterRegistry.get(source.adapterKey);
      const result = await adapter.execute(source, {
        jobId: 'test-run',
        log: async () => {},
      });

      const limited = result.records.slice(0, importConfig.maxRecordsPerJob);
      const warnings = [...result.warnings];
      if (result.records.length > limited.length) {
        warnings.push(`Truncated to ${limited.length} sample records.`);
      }

      const sampleRecords = limited.map((record) => ({
        externalId: record.externalId,
        title: record.normalizedCandidate?.title,
        startDate: record.normalizedCandidate?.startDate,
        validationErrorCount: record.validationErrors?.length ?? 0,
        validationWarningCount: record.validationWarnings?.length ?? 0,
      }));

      const hasErrors = sampleRecords.some((r) => r.validationErrorCount > 0);
      const status: SourceTestResult['status'] =
        sampleRecords.length === 0 && result.records.length === 0
          ? 'failed'
          : hasErrors || warnings.length > 0
            ? 'warning'
            : 'success';

      await this.auditService.logSourceTested(
        this.actorId(session),
        sourceId,
        `${status} (${sampleRecords.length} records)`,
      );

      return {
        success: status !== 'failed',
        status,
        durationMs: Date.now() - started,
        recordCount: sampleRecords.length,
        warnings,
        errors: [],
        sampleRecords,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Test failed.';
      await this.auditService.logSourceTested(this.actorId(session), sourceId, `failed: ${message}`);
      return {
        success: false,
        status: 'failed',
        durationMs: Date.now() - started,
        recordCount: 0,
        warnings: [],
        errors: [message],
        sampleRecords: [],
      };
    }
  }

  async startManualImport(session: AuthSession, sourceId: string): Promise<ImportJob> {
    assertPermission(this.role(session), 'imports:start');

    const source = await this.sourceRepository.getById(sourceId);
    if (!source) {
      throw new ImportError('Source not found.', 'IMPORT_SOURCE_NOT_FOUND');
    }
    if (!source.active) {
      throw new ImportError('Source is deactivated.', 'IMPORT_SOURCE_INACTIVE');
    }

    const activeJob = await this.adminRepository.getActiveJobForSource(sourceId);
    if (activeJob) {
      throw new ImportError(
        'An import is already running for this source.',
        'IMPORT_ACTIVE_JOB_EXISTS',
      );
    }

    const role = this.role(session);
    const sourceRecord = await this.sourceService.getByIdForAdmin(role, sourceId);
    if (!sourceRecord) {
      throw new ImportError('Source not found.', 'IMPORT_SOURCE_NOT_FOUND');
    }

    const job =
      this.aggregationService && this.shouldUseAggregation(sourceRecord)
        ? await this.aggregationService.runFromSourceRecord(
            sourceRecord,
            'manual',
            this.actorId(session),
          )
        : await this.orchestrator.run(sourceId, 'manual', this.actorId(session));

    try {
      await this.sourceService.recordImportRun(this.role(session), sourceId, {
        lastImportAt: job.finishedAt ?? new Date().toISOString(),
        lastJobStatus: job.status,
      });
    } catch (error) {
      mapSourceServiceError(error);
    }

    await this.auditService.logImportStarted(this.actorId(session), sourceId, job.id);
    return job;
  }

  async getMonitoringStats(session: AuthSession | null) {
    assertPermission(this.role(session), 'jobs:read');
    return this.adminRepository.getMonitoringStats();
  }

  checkPermission(session: AuthSession | null, permission: Parameters<typeof assertPermission>[1]) {
    try {
      assertPermission(this.role(session), permission);
      return true;
    } catch {
      return false;
    }
  }

  private shouldUseAggregation(
    sourceRecord: Awaited<ReturnType<SourceService['getByIdForAdmin']>>,
  ): boolean {
    if (!sourceRecord) {
      return false;
    }
    if (sourceRecord.sourceConfig?.reference?.connectorKey) {
      return true;
    }
    return ['manual', 'website', 'ical', 'api', 'rss'].includes(sourceRecord.sourceType);
  }
}

export { ADAPTER_KEYS };
