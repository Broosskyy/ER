import type { SourceRecord } from '@/data/types/records';
import type { AcquisitionStrategy, ParserType, SourceType } from '@/features/sources/domain/source-types';
import { createPreparedAuthConfig } from '@/features/aggregation/domain/source-auth-config';

export const AGGREGATION_SOURCE_STATUSES = [
  'active',
  'inactive',
  'archived',
  'error',
] as const;

export type AggregationSourceStatus = (typeof AGGREGATION_SOURCE_STATUSES)[number];

export const IMPORT_STRATEGIES = [
  'manual',
  'scheduled',
  'webhook',
  'on_demand',
] as const;

export type ImportStrategy = (typeof IMPORT_STRATEGIES)[number];

/** Central aggregation source view — maps from canonical SourceRecord. */
export interface AggregationSource {
  id: string;
  name: string;
  slug: string;
  type: SourceType;
  url?: string;
  countryCode?: string;
  languageCode?: string;
  status: AggregationSourceStatus;
  priority: number;
  syncIntervalMinutes?: number;
  lastSyncedAt?: string;
  errorStatus?: string;
  importStrategy: ImportStrategy;
  parserType: ParserType;
  acquisitionStrategy: AcquisitionStrategy;
  requiresAuthentication: boolean;
  authPrepared: boolean;
  reviewRequired: boolean;
  trustScore: number;
  defaultTimezone?: string;
}

export function resolveAggregationSourceStatus(source: SourceRecord): AggregationSourceStatus {
  if (source.archived) {
    return 'archived';
  }
  if (!source.enabled) {
    return 'inactive';
  }
  if (source.lastJobStatus === 'failed') {
    return 'error';
  }
  return 'active';
}

export function resolveImportStrategy(source: SourceRecord): ImportStrategy {
  if (source.acquisitionStrategy === 'scheduled') {
    return 'scheduled';
  }
  if (source.acquisitionStrategy === 'webhook') {
    return 'webhook';
  }
  if (source.acquisitionStrategy === 'future') {
    return 'on_demand';
  }
  return 'manual';
}

export function mapSourceRecordToAggregationSource(source: SourceRecord): AggregationSource {
  const authConfig = source.sourceConfig?.auth ?? createPreparedAuthConfig(
    source.requiresAuthentication ? 'api_key' : 'none',
  );

  return {
    id: source.id,
    name: source.displayName,
    slug: source.slug,
    type: source.sourceType,
    url: source.baseUrl ?? source.website,
    countryCode: source.countryCode ?? source.sourceConfig?.regional?.countryCode,
    languageCode: source.languageCode ?? source.sourceConfig?.regional?.languageCode,
    status: resolveAggregationSourceStatus(source),
    priority: source.priority,
    syncIntervalMinutes: source.pollingIntervalMinutes,
    lastSyncedAt: source.lastImportAt,
    errorStatus: source.lastJobStatus === 'failed' ? 'last_import_failed' : undefined,
    importStrategy: resolveImportStrategy(source),
    parserType: source.parserType,
    acquisitionStrategy: source.acquisitionStrategy,
    requiresAuthentication: source.requiresAuthentication,
    authPrepared: authConfig.prepared,
    reviewRequired: source.reviewRequired ?? true,
    trustScore: source.trustScore,
    defaultTimezone: source.defaultTimezone,
  };
}
