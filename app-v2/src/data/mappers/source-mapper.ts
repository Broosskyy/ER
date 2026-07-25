import type {
  SourceListParams,
  SourceRecord,
  PaginatedResult,
} from '@/data/types/records';
import type { ImportSource } from '@/features/import/models/types';
import type { ImportJobStatus } from '@/features/import/models/statuses';
import type { ImportSourceConfig } from '@/features/import/models/source-config';
import type {
  AcquisitionStrategy,
  ParserType,
  PollingStrategy,
  SourceType,
} from '@/features/sources/domain/source-types';
import {
  ACQUISITION_STRATEGIES,
  PARSER_TYPES,
  POLLING_STRATEGIES,
  SOURCE_DEFAULT_TRUST_SCORE,
  SOURCE_TYPES,
} from '@/features/sources/domain/source-types';
import { buildSourceSlugBase } from '@/features/sources/domain/source-slug';
import type { SourceInput } from '@/features/sources/domain/source-validation';

export type SourceMutationPayload = SourceInput & {
  id?: string;
  sourceConfig?: ImportSourceConfig;
};

export interface SourceRow {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  source_type: string;
  base_url: string | null;
  parser_type: string;
  acquisition_strategy: string;
  polling_strategy: string | null;
  polling_interval_minutes: number | null;
  rate_limit_per_hour: number | null;
  priority: number;
  trust_score: number;
  requires_authentication: boolean;
  enabled: boolean;
  archived: boolean;
  notes: string | null;
  name: string;
  type: string;
  website: string | null;
  source_url: string | null;
  source_config: ImportSourceConfig | null;
  default_timezone: string | null;
  active: boolean;
  adapter_key: string | null;
  review_required: boolean;
  last_import_at: string | null;
  last_job_status: ImportJobStatus | null;
  next_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

function parseSourceType(value: string): SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value) ? (value as SourceType) : 'unknown';
}

function parseParserType(value: string): ParserType {
  return (PARSER_TYPES as readonly string[]).includes(value) ? (value as ParserType) : 'unknown';
}

function parseAcquisitionStrategy(value: string): AcquisitionStrategy {
  return (ACQUISITION_STRATEGIES as readonly string[]).includes(value)
    ? (value as AcquisitionStrategy)
    : 'manual';
}

function parsePollingStrategy(value: string | null | undefined): PollingStrategy | undefined {
  if (!value) {
    return undefined;
  }
  return value === 'interval' || value === 'cron' || value === 'none'
    ? value
    : undefined;
}

export function mapSourceRowToRecord(row: SourceRow): SourceRecord {
  const displayName = row.display_name || row.name;
  const sourceType = parseSourceType(row.source_type || row.type);
  const parserType = parseParserType(row.parser_type || row.adapter_key || 'unknown');
  const baseUrl = row.base_url ?? row.source_url ?? undefined;
  const enabled = row.enabled ?? row.active;
  const archived = row.archived ?? false;

  return {
    id: row.id,
    slug: row.slug || buildSourceSlugBase(displayName),
    displayName,
    description: row.description ?? undefined,
    sourceType,
    baseUrl,
    parserType,
    acquisitionStrategy: parseAcquisitionStrategy(row.acquisition_strategy),
    pollingStrategy: parsePollingStrategy(row.polling_strategy),
    pollingIntervalMinutes: row.polling_interval_minutes ?? undefined,
    rateLimitPerHour: row.rate_limit_per_hour ?? undefined,
    priority: row.priority ?? 50,
    trustScore: Number(row.trust_score ?? SOURCE_DEFAULT_TRUST_SCORE),
    requiresAuthentication: row.requires_authentication ?? false,
    enabled: archived ? false : enabled,
    archived,
    notes: row.notes ?? undefined,
    sourceConfig: row.source_config ?? undefined,
    defaultTimezone: row.default_timezone ?? undefined,
    reviewRequired: row.review_required ?? true,
    website: row.website ?? undefined,
    lastImportAt: row.last_import_at ?? undefined,
    lastJobStatus: row.last_job_status ?? undefined,
    nextScheduledAt: row.next_scheduled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSourceRecordToRow(record: SourceRecord): SourceRow {
  const legacyActive = record.enabled && !record.archived;
  const legacyAdapterKey =
    record.parserType !== 'unknown' ? record.parserType : null;

  return {
    id: record.id,
    slug: record.slug,
    display_name: record.displayName,
    description: record.description ?? null,
    source_type: record.sourceType,
    base_url: record.baseUrl ?? null,
    parser_type: record.parserType,
    acquisition_strategy: record.acquisitionStrategy,
    polling_strategy: record.pollingStrategy ?? null,
    polling_interval_minutes: record.pollingIntervalMinutes ?? null,
    rate_limit_per_hour: record.rateLimitPerHour ?? null,
    priority: record.priority,
    trust_score: record.trustScore,
    requires_authentication: record.requiresAuthentication,
    enabled: record.enabled,
    archived: record.archived,
    notes: record.notes ?? null,
    name: record.displayName,
    type: record.sourceType,
    website: record.website ?? null,
    source_url: record.baseUrl ?? null,
    source_config: record.sourceConfig ?? null,
    default_timezone: record.defaultTimezone ?? null,
    active: legacyActive,
    adapter_key: legacyAdapterKey,
    review_required: record.reviewRequired ?? true,
    last_import_at: record.lastImportAt ?? null,
    last_job_status: record.lastJobStatus ?? null,
    next_scheduled_at: record.nextScheduledAt ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function mapSourceRecordToImportSource(record: SourceRecord): ImportSource {
  return {
    id: record.id,
    name: record.displayName,
    type: record.sourceType,
    website: record.website ?? record.baseUrl,
    sourceUrl: record.baseUrl,
    sourceConfig: record.sourceConfig,
    defaultTimezone: record.defaultTimezone,
    trustScore: record.trustScore,
    active: record.enabled && !record.archived,
    adapterKey: record.parserType !== 'unknown' ? record.parserType : undefined,
    reviewRequired: record.reviewRequired,
    lastImportAt: record.lastImportAt,
    lastJobStatus: record.lastJobStatus,
    nextScheduledAt: record.nextScheduledAt,
  };
}

export function mapImportSourceToSourceRecord(
  source: ImportSource,
  existing?: Partial<SourceRecord>,
): SourceRecord {
  const now = new Date().toISOString();
  return {
    id: source.id,
    slug: existing?.slug ?? buildSourceSlugBase(source.name),
    displayName: source.name,
    description: existing?.description,
    sourceType: parseSourceType(source.type),
    baseUrl: source.sourceUrl ?? existing?.baseUrl,
    parserType: parseParserType(source.adapterKey ?? existing?.parserType ?? 'unknown'),
    acquisitionStrategy: existing?.acquisitionStrategy ?? 'manual',
    pollingStrategy: existing?.pollingStrategy,
    pollingIntervalMinutes: existing?.pollingIntervalMinutes,
    rateLimitPerHour: existing?.rateLimitPerHour,
    priority: existing?.priority ?? 50,
    trustScore: source.trustScore ?? SOURCE_DEFAULT_TRUST_SCORE,
    requiresAuthentication: existing?.requiresAuthentication ?? false,
    enabled: source.active,
    archived: existing?.archived ?? false,
    notes: existing?.notes,
    sourceConfig: source.sourceConfig,
    defaultTimezone: source.defaultTimezone,
    reviewRequired: source.reviewRequired,
    website: source.website,
    lastImportAt: source.lastImportAt,
    lastJobStatus: source.lastJobStatus,
    nextScheduledAt: source.nextScheduledAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function mapImportSourceToMutationInput(
  source: ImportSource,
  existing?: SourceRecord,
): SourceMutationPayload {
  const record = mapImportSourceToSourceRecord(source, existing);
  return {
    id: record.id,
    slug: record.slug,
    displayName: record.displayName,
    description: record.description,
    sourceType: record.sourceType,
    baseUrl: record.baseUrl,
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
    defaultTimezone: record.defaultTimezone,
    reviewRequired: record.reviewRequired,
    sourceConfig: record.sourceConfig,
  };
}

export function applySourceListParams(
  items: SourceRecord[],
  params: SourceListParams,
): PaginatedResult<SourceRecord> {
  let filtered = [...items];
  const query = params.query?.trim().toLowerCase();

  if (query) {
    filtered = filtered.filter((source) => {
      const haystack = [
        source.displayName,
        source.slug,
        source.baseUrl,
        source.sourceType,
        source.parserType,
        source.acquisitionStrategy,
        source.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  if (params.sourceType) {
    filtered = filtered.filter((source) => source.sourceType === params.sourceType);
  }

  if (params.parserType) {
    filtered = filtered.filter((source) => source.parserType === params.parserType);
  }

  if (params.acquisitionStrategy) {
    filtered = filtered.filter(
      (source) => source.acquisitionStrategy === params.acquisitionStrategy,
    );
  }

  if (params.enabled !== undefined) {
    filtered = filtered.filter((source) => source.enabled === params.enabled);
  }

  if (params.archived !== undefined) {
    filtered = filtered.filter((source) => source.archived === params.archived);
  }

  if (params.requiresAuthentication !== undefined) {
    filtered = filtered.filter(
      (source) => source.requiresAuthentication === params.requiresAuthentication,
    );
  }

  if (params.minTrustScore !== undefined) {
    filtered = filtered.filter((source) => source.trustScore >= params.minTrustScore!);
  }

  if (params.maxTrustScore !== undefined) {
    filtered = filtered.filter((source) => source.trustScore <= params.maxTrustScore!);
  }

  if (params.minPriority !== undefined) {
    filtered = filtered.filter((source) => source.priority >= params.minPriority!);
  }

  if (params.maxPriority !== undefined) {
    filtered = filtered.filter((source) => source.priority <= params.maxPriority!);
  }

  const sortBy = params.sortBy ?? 'priority';
  filtered.sort((left, right) => {
    if (sortBy === 'displayName') {
      return left.displayName.localeCompare(right.displayName);
    }
    if (sortBy === 'trustScore') {
      return right.trustScore - left.trustScore || left.displayName.localeCompare(right.displayName);
    }
    if (sortBy === 'sourceType') {
      return left.sourceType.localeCompare(right.sourceType) || left.displayName.localeCompare(right.displayName);
    }
    if (sortBy === 'updated') {
      return right.updatedAt.localeCompare(left.updatedAt);
    }
    if (sortBy === 'created') {
      return right.createdAt.localeCompare(left.createdAt);
    }
    return right.priority - left.priority || left.displayName.localeCompare(right.displayName);
  });

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 50);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export function createDefaultSourceRecord(
  id: string,
  displayName: string,
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const now = new Date().toISOString();
  const slug = overrides.slug ?? buildSourceSlugBase(displayName);

  return {
    id,
    slug,
    displayName,
    description: overrides.description,
    sourceType: overrides.sourceType ?? 'manual',
    baseUrl: overrides.baseUrl,
    parserType: overrides.parserType ?? 'unknown',
    acquisitionStrategy: overrides.acquisitionStrategy ?? 'manual',
    pollingStrategy: overrides.pollingStrategy,
    pollingIntervalMinutes: overrides.pollingIntervalMinutes,
    rateLimitPerHour: overrides.rateLimitPerHour,
    priority: overrides.priority ?? 50,
    trustScore: overrides.trustScore ?? SOURCE_DEFAULT_TRUST_SCORE,
    requiresAuthentication: overrides.requiresAuthentication ?? false,
    enabled: overrides.enabled ?? true,
    archived: overrides.archived ?? false,
    notes: overrides.notes,
    sourceConfig: overrides.sourceConfig,
    defaultTimezone: overrides.defaultTimezone,
    reviewRequired: overrides.reviewRequired ?? true,
    website: overrides.website,
    lastImportAt: overrides.lastImportAt,
    lastJobStatus: overrides.lastJobStatus,
    nextScheduledAt: overrides.nextScheduledAt,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}
