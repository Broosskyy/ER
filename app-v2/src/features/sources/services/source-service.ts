import { AppError } from '@/core/errors/app-error';
import type { SourceRecord, SourceListParams, PaginatedResult } from '@/data/types/records';
import {
  mapImportSourceToMutationInput,
  mapSourceRecordToImportSource,
} from '@/data/mappers/source-mapper';
import {
  canManageSources,
  canViewSources,
} from '@/features/admin/admin-permissions';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import type { ImportSource } from '@/features/import/models/types';
import type { ImportJobStatus } from '@/features/import/models/statuses';
import {
  findStrongSourceDuplicate,
} from '@/features/sources/domain/source-duplicate';
import {
  buildSourceSlugBase,
  resolveUniqueSourceSlug,
} from '@/features/sources/domain/source-slug';
import { validateSourceInput, type SourceInput } from '@/features/sources/domain/source-validation';

export interface SourceMutationInput extends SourceInput {
  id?: string;
  sourceConfig?: SourceRecord['sourceConfig'];
}

export interface SourceImportRunMetadata {
  lastImportAt: string;
  lastJobStatus: ImportJobStatus;
}

function assertCanView(role: AdminRole | null): void {
  if (!canViewSources(role)) {
    throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
  }
}

function assertCanMutate(role: AdminRole | null): void {
  if (!canManageSources(role)) {
    throw new AppError('You do not have permission to manage sources.', { code: 'UNAUTHORIZED' });
  }
}

export class SourceService {
  constructor(
    private readonly repository: {
      list(params: SourceListParams): Promise<PaginatedResult<SourceRecord>>;
      getById(id: string): Promise<SourceRecord | null>;
      getBySlug(slug: string): Promise<SourceRecord | null>;
      getAll(): Promise<SourceRecord[]>;
      save(record: SourceRecord): Promise<SourceRecord>;
      archive(id: string): Promise<SourceRecord | null>;
      restore(id: string): Promise<SourceRecord | null>;
      countImportJobsForSource(sourceId: string): Promise<number>;
    },
  ) {}

  async listForAdmin(
    role: AdminRole | null,
    params: SourceListParams = {},
  ): Promise<PaginatedResult<SourceRecord>> {
    assertCanView(role);
    return this.repository.list(params);
  }

  async getByIdForAdmin(role: AdminRole | null, id: string): Promise<SourceRecord | null> {
    assertCanView(role);
    return this.repository.getById(id);
  }

  async getBySlugForAdmin(role: AdminRole | null, slug: string): Promise<SourceRecord | null> {
    assertCanView(role);
    return this.repository.getBySlug(slug);
  }

  async create(role: AdminRole | null, input: SourceMutationInput): Promise<SourceRecord> {
    assertCanMutate(role);
    const validated = validateSourceInput(input);
    const existingSources = await this.repository.getAll();

    const duplicate = findStrongSourceDuplicate(
      { slug: validated.slug, baseUrl: validated.baseUrl },
      existingSources,
    );
    if (duplicate) {
      const label =
        duplicate.reason === 'slug'
          ? 'slug'
          : 'base URL';
      throw new AppError(`A source with this ${label} already exists.`, { code: 'VALIDATION' });
    }

    const slugBase = validated.slug ?? buildSourceSlugBase(validated.displayName);
    const slug = resolveUniqueSourceSlug(
      slugBase,
      existingSources.map((source) => source.slug),
    );

    const now = new Date().toISOString();
    const id = input.id ?? `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return this.repository.save({
      id,
      slug,
      displayName: validated.displayName,
      description: validated.description,
      sourceType: validated.sourceType,
      baseUrl: validated.baseUrl,
      parserType: validated.parserType,
      acquisitionStrategy: validated.acquisitionStrategy,
      pollingStrategy: validated.pollingStrategy,
      pollingIntervalMinutes: validated.pollingIntervalMinutes,
      rateLimitPerHour: validated.rateLimitPerHour,
      priority: validated.priority,
      trustScore: validated.trustScore,
      requiresAuthentication: validated.requiresAuthentication,
      enabled: validated.enabled,
      archived: validated.archived,
      notes: validated.notes,
      sourceConfig: input.sourceConfig,
      defaultTimezone: validated.defaultTimezone,
      reviewRequired: validated.reviewRequired,
      website: validated.website,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(
    role: AdminRole | null,
    input: SourceMutationInput & { id: string },
  ): Promise<SourceRecord> {
    assertCanMutate(role);
    const existing = await this.repository.getById(input.id);
    if (!existing) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }

    const validated = validateSourceInput({
      ...input,
      enabled: input.archived ? false : input.enabled ?? existing.enabled,
    });
    const existingSources = await this.repository.getAll();

    const duplicate = findStrongSourceDuplicate(
      { slug: validated.slug ?? existing.slug, baseUrl: validated.baseUrl },
      existingSources,
      existing.id,
    );
    if (duplicate) {
      const label = duplicate.reason === 'slug' ? 'slug' : 'base URL';
      throw new AppError(`A source with this ${label} already exists.`, { code: 'VALIDATION' });
    }

    const slug = validated.slug ?? existing.slug;
    if (slug !== existing.slug) {
      const taken = existingSources.some(
        (source) => source.slug === slug && source.id !== existing.id,
      );
      if (taken) {
        throw new AppError('Source slug is already in use.', { code: 'VALIDATION' });
      }
    }

    if (validated.archived && validated.enabled) {
      throw new AppError('Archived sources cannot be enabled.', { code: 'VALIDATION' });
    }

    return this.repository.save({
      ...existing,
      slug,
      displayName: validated.displayName,
      description: validated.description,
      sourceType: validated.sourceType,
      baseUrl: validated.baseUrl,
      parserType: validated.parserType,
      acquisitionStrategy: validated.acquisitionStrategy,
      pollingStrategy: validated.pollingStrategy,
      pollingIntervalMinutes: validated.pollingIntervalMinutes,
      rateLimitPerHour: validated.rateLimitPerHour,
      priority: validated.priority,
      trustScore: validated.trustScore,
      requiresAuthentication: validated.requiresAuthentication,
      enabled: validated.archived ? false : validated.enabled,
      archived: validated.archived,
      notes: validated.notes,
      sourceConfig: input.sourceConfig ?? existing.sourceConfig,
      defaultTimezone: validated.defaultTimezone,
      reviewRequired: validated.reviewRequired,
      website: validated.website,
      updatedAt: new Date().toISOString(),
    });
  }

  async setEnabled(role: AdminRole | null, id: string, enabled: boolean): Promise<SourceRecord> {
    assertCanMutate(role);
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }
    if (existing.archived && enabled) {
      throw new AppError('Archived sources cannot be enabled.', { code: 'VALIDATION' });
    }
    return this.repository.save({
      ...existing,
      enabled,
      updatedAt: new Date().toISOString(),
    });
  }

  async archive(role: AdminRole | null, id: string): Promise<SourceRecord> {
    assertCanMutate(role);
    const archived = await this.repository.archive(id);
    if (!archived) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }
    return archived;
  }

  async restore(role: AdminRole | null, id: string): Promise<SourceRecord> {
    assertCanMutate(role);
    const restored = await this.repository.restore(id);
    if (!restored) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }
    return restored;
  }

  async countImportJobs(role: AdminRole | null, sourceId: string): Promise<number> {
    assertCanView(role);
    return this.repository.countImportJobsForSource(sourceId);
  }

  async updateConnectorAssignment(
    role: AdminRole | null,
    sourceId: string,
    connectorKey: string | undefined,
    endpointPlaceholder?: string,
  ): Promise<SourceRecord> {
    assertCanMutate(role);
    const existing = await this.repository.getById(sourceId);
    if (!existing) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }

    const nextConfig = {
      ...(existing.sourceConfig ?? {}),
      connector: connectorKey
        ? {
            connectorKey,
            endpointPlaceholder: endpointPlaceholder?.trim() || undefined,
          }
        : undefined,
    };

    return this.repository.save({
      ...existing,
      sourceConfig: nextConfig,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Persists an ImportSource through the canonical validation pipeline.
   * Used by legacy import administration flows.
   */
  async saveFromImportSource(
    role: AdminRole | null,
    source: ImportSource,
    isNew: boolean,
  ): Promise<SourceRecord> {
    assertCanMutate(role);
    const existing = isNew ? null : await this.repository.getById(source.id);
    const input = mapImportSourceToMutationInput(source, existing ?? undefined);

    if (isNew) {
      return this.create(role, { ...input, id: source.id });
    }

    return this.update(role, { ...input, id: source.id });
  }

  /**
   * Records operational import metadata on a source after a job completes.
   * Does not re-run duplicate or URL validation.
   */
  async recordImportRun(
    role: AdminRole | null,
    sourceId: string,
    metadata: SourceImportRunMetadata,
  ): Promise<SourceRecord> {
    assertCanMutate(role);
    const existing = await this.repository.getById(sourceId);
    if (!existing) {
      throw new AppError('Source not found.', { code: 'NOT_FOUND' });
    }

    return this.repository.save({
      ...existing,
      lastImportAt: metadata.lastImportAt,
      lastJobStatus: metadata.lastJobStatus,
      updatedAt: new Date().toISOString(),
    });
  }
}
