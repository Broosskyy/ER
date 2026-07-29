import type { SourceRecord } from '@/data/types/records';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { SourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type {
  SourceAdminDetailView,
  SourceAdminEditorModel,
  SourceAdminListItem,
  SourceAdminTestImportResult,
  SourceAdminWebsiteDetectionResult,
  SourceAdminWebsiteExtractionPreview,
} from '@/features/sources/admin/source-admin-models';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import { getWebsiteStrategy } from '@/features/aggregation/connectors/website/strategy-selector';
import { resolveWebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import { inferSourceCategory } from '@/features/sources/domain/source-categories';
import {
  type SourceImportHistoryEntry,
  type SourceImportHistoryStore,
  sourceImportHistoryStore,
} from '@/features/sources/domain/source-import-history';
import {
  resolveRecordCategory,
  resolveRecordConnectorKey,
  resolveRecordStatus,
  validateSourceRecord,
  type SourceValidationResult,
} from '@/features/sources/domain/source-management-validation';
import { applySourceManagementStatus, type SourceManagementStatus } from '@/features/sources/domain/source-status';
import {
  SourceService,
  type SourceMutationInput,
} from '@/features/sources/services/source-service';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import type { SourceListParams, PaginatedResult } from '@/data/types/records';
import { AppError } from '@/core/errors/app-error';

function createHistoryId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapToListItem(record: SourceRecord): SourceAdminListItem {
  return {
    id: record.id,
    displayName: record.displayName,
    slug: record.slug,
    category: resolveRecordCategory(record),
    status: resolveRecordStatus(record),
    connectorKey: resolveRecordConnectorKey(record),
    enabled: record.enabled,
    archived: record.archived,
    priority: record.priority,
    trustScore: record.trustScore,
    countryCode: record.countryCode,
    city: record.city,
    lastImportAt: record.lastImportAt,
    lastSuccessfulSyncAt: record.lastSuccessfulSyncAt,
    lastFailedImportAt: record.lastFailedImportAt,
    updatedAt: record.updatedAt,
  };
}

export class SourceManagementService {
  constructor(
    private readonly sourceService: SourceService,
    private readonly connectorRegistry: SourceConnectorRegistry,
    private readonly historyStore: SourceImportHistoryStore = sourceImportHistoryStore,
  ) {}

  async listSources(
    role: AdminRole | null,
    params: SourceListParams = {},
  ): Promise<PaginatedResult<SourceAdminListItem>> {
    const result = await this.sourceService.listForAdmin(role, params);
    let items = result.items.map(mapToListItem);

    if (params.category) {
      items = items.filter((item) => item.category === params.category);
    }
    if (params.status) {
      items = items.filter((item) => item.status === params.status);
    }
    if (params.connectorKey) {
      items = items.filter((item) => item.connectorKey === params.connectorKey);
    }
    if (params.countryCode) {
      items = items.filter((item) => {
        const record = result.items.find((source) => source.id === item.id);
        return record?.countryCode === params.countryCode;
      });
    }
    if (params.region) {
      items = items.filter((item) => {
        const record = result.items.find((source) => source.id === item.id);
        return record?.region === params.region;
      });
    }
    if (params.city) {
      items = items.filter((item) => item.city === params.city);
    }

    return {
      ...result,
      items,
      total: items.length,
    };
  }

  async getSource(role: AdminRole | null, id: string): Promise<SourceAdminDetailView | null> {
    const record = await this.sourceService.getByIdForAdmin(role, id);
    if (!record) {
      return null;
    }
    return this.buildDetailView(record);
  }

  async createSource(role: AdminRole | null, input: SourceMutationInput): Promise<SourceRecord> {
    const validation = this.validateSource(input);
    if (!validation.valid) {
      throw new AppError(validation.issues[0]?.message ?? 'Source validation failed.', {
        code: 'VALIDATION',
      });
    }
    const enriched = this.enrichMutationInput(input);
    return this.sourceService.create(role, enriched);
  }

  async updateSource(
    role: AdminRole | null,
    input: SourceMutationInput & { id: string },
  ): Promise<SourceRecord> {
    const existing = await this.sourceService.getByIdForAdmin(role, input.id);
    if (!existing) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }
    const merged = { ...this.toMutationInput(existing), ...input, id: input.id };
    const validation = this.validateSource(merged);
    if (!validation.valid) {
      throw new AppError(validation.issues[0]?.message ?? 'Source validation failed.', {
        code: 'VALIDATION',
      });
    }
    const enriched = this.enrichMutationInput(merged);
    return this.sourceService.update(role, { ...enriched, id: input.id });
  }

  async deleteSource(role: AdminRole | null, id: string): Promise<SourceRecord> {
    return this.archiveSource(role, id);
  }

  async archiveSource(role: AdminRole | null, id: string): Promise<SourceRecord> {
    await this.sourceService.archive(role, id);
    const existing = await this.sourceService.getByIdForAdmin(role, id);
    if (!existing) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }
    return this.updateSource(role, {
      ...this.toMutationInput(existing),
      id: existing.id,
      archived: true,
      enabled: false,
      status: 'archived',
    });
  }

  async enableSource(role: AdminRole | null, id: string): Promise<SourceRecord> {
    const existing = await this.sourceService.getByIdForAdmin(role, id);
    if (!existing) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }
    await this.sourceService.setEnabled(role, id, true);
    return this.updateSource(role, {
      ...this.toMutationInput(existing),
      id: existing.id,
      enabled: true,
      archived: false,
      status: 'active',
    });
  }

  async disableSource(role: AdminRole | null, id: string): Promise<SourceRecord> {
    const existing = await this.sourceService.getByIdForAdmin(role, id);
    if (!existing) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }
    await this.sourceService.setEnabled(role, id, false);
    return this.updateSource(role, {
      ...this.toMutationInput(existing),
      id: existing.id,
      enabled: false,
      status: 'disabled',
    });
  }

  validateSource(input: SourceMutationInput): SourceValidationResult {
    return validateSourceRecord(input);
  }

  buildEditorModel(record: SourceRecord): SourceAdminEditorModel {
    const validation = validateSourceRecord(record);
    const connectorKey = resolveRecordConnectorKey(record);
    const status = resolveRecordStatus(record);

    return {
      record,
      category: resolveRecordCategory(record),
      status,
      connectorKey,
      validation,
      canEnable: !record.archived && status !== 'active',
      canArchive: !record.archived,
      canTestImport: Boolean(connectorKey) && !record.archived,
      canRunWebsiteDetection: this.isWebsiteConnector(connectorKey) && !record.archived,
    };
  }

  validateWebsiteConfiguration(record: SourceRecord): SourceValidationResult {
    const config = resolveWebsiteConnectorConfig(record.sourceConfig);
    const strategyKey = config.preferredStrategy ?? 'json_ld';
    const strategy = getWebsiteStrategy(strategyKey);
    if (!strategy) {
      return {
        valid: false,
        issues: [{ code: 'invalid_connector', field: 'website.preferredStrategy', message: 'Unknown website strategy.' }],
      };
    }
    const result = strategy.validateConfiguration(config);
    return {
      valid: result.valid,
      issues: result.issues.map((issue) => ({
        code: 'incomplete_configuration',
        field: issue.field,
        message: issue.message,
      })),
    };
  }

  async runWebsiteDetection(
    role: AdminRole | null,
    sourceId: string,
  ): Promise<SourceAdminWebsiteDetectionResult> {
    const record = await this.sourceService.getByIdForAdmin(role, sourceId);
    if (!record) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }
    const connectorKey = resolveRecordConnectorKey(record);
    if (!this.isWebsiteConnector(connectorKey)) {
      throw new AppError('Source is not a website connector.', { code: 'VALIDATION' });
    }

    const url = record.baseUrl ?? record.website ?? 'https://events.example.com/website';
    const importSource = mapSourceRecordToImportSource(record);
    const detection = await websiteProcessor.detect({
      url,
      importSource,
      connectorKey: connectorKey!,
      htmlOverride: record.sourceConfig?.reference?.html,
    });

    return {
      sourceId: record.id,
      requestedUrl: url,
      detection,
      recommendedStrategy: detection.recommendedStrategy,
    };
  }

  async runWebsiteExtractionPreview(
    role: AdminRole | null,
    sourceId: string,
  ): Promise<SourceAdminWebsiteExtractionPreview> {
    const record = await this.sourceService.getByIdForAdmin(role, sourceId);
    if (!record) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }
    const connectorKey = resolveRecordConnectorKey(record);
    if (!this.isWebsiteConnector(connectorKey)) {
      throw new AppError('Source is not a website connector.', { code: 'VALIDATION' });
    }

    const url = record.baseUrl ?? record.website ?? 'https://events.example.com/website';
    const importSource = mapSourceRecordToImportSource(record);
    const output = await websiteProcessor.process({
      url,
      importSource,
      connectorKey: connectorKey!,
      htmlOverride: record.sourceConfig?.reference?.html,
    });

    return {
      sourceId: record.id,
      strategy: output.result.diagnostics.strategy,
      eventCount: output.events.length,
      diagnostics: output.result.diagnostics,
      previewEvents: output.result.events.slice(0, 10).map((event) => ({
        externalId: event.externalId,
        title: event.title,
        rawStartDate: event.rawStartDate,
        rawVenue: event.rawVenue,
        extractionStrategy: event.extractionStrategy,
        extractionConfidence: event.extractionConfidence,
      })),
    };
  }

  private isWebsiteConnector(connectorKey?: string): boolean {
    return connectorKey === 'club_website' || connectorKey === 'organizer_website';
  }

  async runTestImport(role: AdminRole | null, sourceId: string): Promise<SourceAdminTestImportResult> {
    const record = await this.sourceService.getByIdForAdmin(role, sourceId);
    if (!record) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }

    const connectorKey = resolveRecordConnectorKey(record);
    if (!connectorKey) {
      throw new AppError('Source has no resolvable connector for test import.', { code: 'VALIDATION' });
    }

    const connector = this.connectorRegistry.get(connectorKey);
    const importSource = mapSourceRecordToImportSource(record);
    const aggregationSource = mapSourceRecordToAggregationSource(record);
    const context: PipelineRunContext = {
      runId: `test-${createHistoryId()}`,
      source: aggregationSource,
      triggerType: 'manual',
      startedAt: new Date().toISOString(),
    };

    const startedAt = new Date().toISOString();
    const result = await this.connectorRegistry.getExecutor().execute(
      connector,
      aggregationSource,
      importSource,
      context,
    );
    const completedAt = new Date().toISOString();

    const historyEntry: SourceImportHistoryEntry = {
      id: createHistoryId(),
      sourceId: record.id,
      startedAt,
      completedAt,
      status: result.diagnostics.errors.length > 0 ? 'partial' : 'completed',
      durationMs: result.diagnostics.durationMs,
      eventCount: result.events.length,
      skippedCount: result.diagnostics.skippedRecords,
      errorCount: result.diagnostics.errors.length,
      warningCount: result.diagnostics.warnings.length,
      errors: result.diagnostics.errors.map((error) => ({ code: error.code, message: error.message })),
      warnings: result.diagnostics.warnings.map((warning) => ({
        code: warning.code,
        message: warning.message,
      })),
      connectorKey,
      connectorVersion: result.diagnostics.connectorVersion,
      testImport: true,
    };
    this.historyStore.append(historyEntry);

    return {
      sourceId: record.id,
      startedAt,
      completedAt,
      durationMs: result.diagnostics.durationMs,
      eventCount: result.events.length,
      diagnostics: result.diagnostics,
      previewEvents: result.events.slice(0, 10).map((event) => ({
        externalId: event.externalId,
        title: event.title,
        startDate: event.startDate,
        cityName: event.cityName,
        venueName: event.venueName,
      })),
    };
  }

  getImportHistory(sourceId: string): SourceImportHistoryEntry[] {
    return this.historyStore.listForSource(sourceId);
  }

  private buildDetailView(record: SourceRecord): SourceAdminDetailView {
    const connectorKey = resolveRecordConnectorKey(record);
    const validation = validateSourceRecord(record);

    return {
      ...mapToListItem(record),
      description: record.description,
      baseUrl: record.baseUrl,
      website: record.website,
      region: record.region,
      stateCode: record.stateCode,
      genreNames: record.genreNames,
      organizerId: record.organizerId,
      organizerName: record.organizerName,
      venueId: record.venueId,
      venueName: record.venueName,
      tags: record.tags,
      languageCode: record.languageCode,
      defaultTimezone: record.defaultTimezone,
      pollingIntervalMinutes: record.pollingIntervalMinutes,
      reviewRequired: record.reviewRequired,
      autoEnabled: record.autoEnabled,
      sourceType: record.sourceType,
      parserType: record.parserType,
      acquisitionStrategy: record.acquisitionStrategy,
      validationIssues: validation.issues,
      connectorHealth: connectorKey ? this.connectorRegistry.getHealth(connectorKey) : undefined,
      connectorMetrics: connectorKey ? this.connectorRegistry.getMetrics(connectorKey) : undefined,
      importHistory: this.historyStore.listForSource(record.id),
      createdAt: record.createdAt,
    };
  }

  private enrichMutationInput(input: SourceMutationInput): SourceMutationInput {
    const category =
      input.category ??
      inferSourceCategory({
        category: input.category,
        sourceType: input.sourceType,
        parserType: input.parserType,
        connectorKey: input.connectorKey,
      });

    const status = input.status as SourceManagementStatus | undefined;
    const flags = status
      ? applySourceManagementStatus(status, {
          enabled: input.enabled ?? true,
          archived: input.archived ?? false,
        })
      : undefined;

    const connectorKey = input.connectorKey;
    const sourceConfig = connectorKey
      ? {
          ...(input.sourceConfig ?? {}),
          reference: {
            ...(input.sourceConfig?.reference ?? {}),
            connectorKey: connectorKey as NonNullable<
              NonNullable<SourceMutationInput['sourceConfig']>['reference']
            >['connectorKey'],
          },
        }
      : input.sourceConfig;

    return {
      ...input,
      category,
      enabled: flags?.enabled ?? input.enabled,
      archived: flags?.archived ?? input.archived,
      status: flags?.status ?? input.status,
      sourceConfig,
    };
  }

  private toMutationInput(record: SourceRecord): SourceMutationInput {
    return {
      displayName: record.displayName,
      description: record.description,
      sourceType: record.sourceType,
      parserType: record.parserType,
      acquisitionStrategy: record.acquisitionStrategy,
      pollingStrategy: record.pollingStrategy,
      pollingIntervalMinutes: record.pollingIntervalMinutes,
      rateLimitPerHour: record.rateLimitPerHour,
      priority: record.priority,
      trustScore: record.trustScore,
      requiresAuthentication: record.requiresAuthentication,
      enabled: record.enabled,
      archived: record.archived,
      notes: record.notes,
      website: record.website,
      baseUrl: record.baseUrl,
      defaultTimezone: record.defaultTimezone,
      reviewRequired: record.reviewRequired,
      sourceConfig: record.sourceConfig,
      stableKey: record.stableKey,
      category: record.category,
      status: record.status,
      connectorKey: record.connectorKey ?? resolveRecordConnectorKey(record),
      connectorType: record.connectorType,
      countryCode: record.countryCode,
      region: record.region,
      stateCode: record.stateCode,
      city: record.city,
      languageCode: record.languageCode,
      languageCodes: record.languageCodes,
      genreNames: record.genreNames,
      organizerId: record.organizerId,
      organizerName: record.organizerName,
      venueId: record.venueId,
      venueName: record.venueName,
      tags: record.tags,
      autoEnabled: record.autoEnabled,
      metadata: record.metadata,
    };
  }
}
