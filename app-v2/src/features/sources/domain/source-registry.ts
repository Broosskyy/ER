import type { SourceRecord } from '@/data/types/records';

export const SOURCE_REGISTRY_TYPES = [
  'manual_reference',
  'club_website',
  'organizer_website',
  'festival_website',
  'venue_website',
  'artist_website',
  'ical_feed',
  'rss_feed',
  'atom_feed',
  'open_data_api',
  'official_api',
  'partner_feed',
  'csv_import',
  'xml_feed',
  'social_reference',
  'ticket_platform',
  'future_connector',
] as const;

export type SourceRegistryType = (typeof SOURCE_REGISTRY_TYPES)[number];

export const SOURCE_LIFECYCLE_STATUSES = [
  'draft',
  'testing',
  'active',
  'degraded',
  'paused',
  'failing',
  'disabled',
  'retired',
  'blocked',
] as const;

export type SourceLifecycleStatus = (typeof SOURCE_LIFECYCLE_STATUSES)[number];

export const SOURCE_HEALTH_STATUSES = [
  'healthy',
  'warning',
  'degraded',
  'critical',
  'unknown',
] as const;

export type SourceHealthStatus = (typeof SOURCE_HEALTH_STATUSES)[number];

export const SOURCE_QUALITY_TIERS = ['A', 'B', 'C', 'D', 'unknown'] as const;
export type SourceQualityTier = (typeof SOURCE_QUALITY_TIERS)[number];

export interface SourceRegistryMetrics {
  consecutiveFailureCount: number;
  totalImportCount: number;
  totalValidEventCount: number;
  totalRejectedEventCount: number;
  duplicateRate: number;
  updateRate: number;
  errorRate: number;
  averageDurationMs?: number;
}

export interface SourceRegistryEntry extends SourceRegistryMetrics {
  id: string;
  stableKey: string;
  name: string;
  displayName: string;
  sourceType: SourceRegistryType;
  connectorType: string;
  canonicalUrl?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  languageCodes: string[];
  timezone?: string;
  category?: string;
  ownershipType?: 'official' | 'partner' | 'community' | 'unknown';
  trustLevel: number;
  qualityTier: SourceQualityTier;
  priority: number;
  status: SourceLifecycleStatus;
  enabled: boolean;
  syncStrategy: 'manual' | 'scheduled' | 'webhook' | 'future';
  syncIntervalMinutes?: number;
  lastSuccessfulSyncAt?: string;
  lastAttemptAt?: string;
  nextSyncAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  connectorConfig: Record<string, unknown>;
  authenticationConfig?: {
    type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth';
    tokenEnvKey?: string;
    prepared: boolean;
  };
}

export interface SourceStatusHistoryEntry {
  id: string;
  sourceId: string;
  previousStatus: SourceLifecycleStatus;
  nextStatus: SourceLifecycleStatus;
  reason: string;
  changedAt: string;
  changedBy?: string;
  automatic: boolean;
}

export const SOURCE_RELATION_TYPES = [
  'same_owner',
  'same_brand',
  'official_partner',
  'mirror',
  'regional_variant',
  'language_variant',
  'ticket_partner',
  'venue_and_organizer',
  'replacement',
  'unknown',
] as const;

export interface SourceGroup {
  id: string;
  name: string;
  type: string;
  parentGroupId?: string;
  sourceIds: string[];
  priorityPolicy?: string;
  mergePolicy?: string;
  regionScope?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SourceRelation {
  id: string;
  sourceId: string;
  relatedSourceId: string;
  relationType: (typeof SOURCE_RELATION_TYPES)[number];
  confidence: number;
  verified: boolean;
  createdAt: string;
}

function registryTypeForSource(record: SourceRecord): SourceRegistryType {
  const connectorKey = record.sourceConfig?.reference?.connectorKey;
  if (connectorKey && SOURCE_REGISTRY_TYPES.includes(connectorKey)) {
    return connectorKey;
  }
  if (record.sourceType === 'manual') return 'manual_reference';
  if (record.sourceType === 'ical') return 'ical_feed';
  if (record.sourceType === 'rss') return 'rss_feed';
  if (record.sourceType === 'api') return 'open_data_api';
  if (record.sourceType === 'website') return 'club_website';
  return 'future_connector';
}

export function mapSourceRecordToRegistryEntry(record: SourceRecord): SourceRegistryEntry {
  const sourceType = registryTypeForSource(record);
  const sourceConfig = record.sourceConfig as Record<string, unknown> | undefined;
  const regional = sourceConfig?.regional as
    | { languageCode?: string; countryCode?: string }
    | undefined;

  return {
    id: record.id,
    stableKey: record.stableKey ?? record.slug,
    name: record.displayName,
    displayName: record.displayName,
    sourceType,
    connectorType: record.connectorType ?? record.connectorKey ?? record.parserType,
    canonicalUrl: record.baseUrl ?? record.website,
    countryCode: record.countryCode ?? regional?.countryCode,
    region: record.region,
    city: record.city,
    category: record.category,
    languageCodes:
      record.languageCodes ??
      [record.languageCode ?? regional?.languageCode].filter(
        (value): value is string => Boolean(value),
      ),
    timezone: record.defaultTimezone,
    trustLevel: record.trustScore,
    qualityTier: 'unknown',
    priority: record.priority,
    status: record.status === 'archived' || record.archived
      ? 'retired'
      : record.status === 'active' || record.enabled
        ? 'active'
        : record.status === 'error'
          ? 'failing'
          : record.status === 'maintenance'
            ? 'paused'
            : record.status === 'draft'
              ? 'draft'
              : 'disabled',
    enabled: record.enabled,
    syncStrategy: record.acquisitionStrategy,
    syncIntervalMinutes: record.pollingIntervalMinutes,
    lastSuccessfulSyncAt: record.lastSuccessfulSyncAt ?? record.lastImportAt,
    lastAttemptAt: record.lastAttemptAt,
    nextSyncAt: record.nextScheduledAt,
    consecutiveFailureCount: record.consecutiveFailureCount ?? 0,
    totalImportCount: record.totalImportCount ?? 0,
    totalValidEventCount: record.totalValidEventCount ?? 0,
    totalRejectedEventCount: record.totalRejectedEventCount ?? 0,
    duplicateRate: record.duplicateRate ?? 0,
    updateRate: record.updateRate ?? 0,
    errorRate: record.errorRate ?? 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metadata: {
      ...(record.metadata ?? {}),
      publishMode: record.publishMode,
      sourceRoles: record.sourceRoles,
      lastError: record.lastError,
    },
    connectorConfig: sourceConfig ?? {},
  };
}
