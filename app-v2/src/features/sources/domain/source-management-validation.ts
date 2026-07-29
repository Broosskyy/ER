import { resolveSourceConnectorKey } from '@/features/aggregation/connectors/source-connector-resolution';
import type { SourceRecord } from '@/data/types/records';
import { SOURCE_CONNECTOR_KEYS, type SourceConnectorKey } from '@/features/aggregation/connectors/types';
import {
  inferSourceCategory,
  isSourceCategory,
  type SourceCategory,
} from '@/features/sources/domain/source-categories';
import {
  isSourceManagementStatus,
  type SourceManagementStatus,
} from '@/features/sources/domain/source-status';
import { validateSourceInput, type SourceInput } from '@/features/sources/domain/source-validation';

export type SourceValidationIssueCode =
  | 'required_field'
  | 'invalid_url'
  | 'invalid_category'
  | 'invalid_status'
  | 'invalid_connector'
  | 'incomplete_configuration'
  | 'archived_enabled_conflict';

export interface SourceValidationIssue {
  code: SourceValidationIssueCode;
  field?: string;
  message: string;
}

export interface SourceValidationResult {
  valid: boolean;
  issues: SourceValidationIssue[];
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveConnectorKey(
  record: Pick<SourceRecord, 'sourceConfig' | 'parserType' | 'sourceType' | 'sourceRoles'>,
): string | undefined {
  const assigned = record.sourceConfig?.connector?.connectorKey;
  if (assigned) {
    return assigned;
  }
  try {
    return resolveSourceConnectorKey({
      connectorKey: record.sourceConfig?.reference?.connectorKey,
      sourceType: record.sourceType,
      parserType: record.parserType,
      sourceRoles: record.sourceRoles,
    });
  } catch {
    return undefined;
  }
}

function validateConfigurationCompleteness(
  record: Pick<SourceRecord, 'sourceType' | 'parserType' | 'sourceConfig' | 'baseUrl' | 'website'>,
  connectorKey?: string,
): SourceValidationIssue[] {
  const issues: SourceValidationIssue[] = [];

  if (record.sourceType === 'manual') {
    const hasEvents = (record.sourceConfig?.reference?.events?.length ?? 0) > 0;
    const hasFixture =
      record.sourceConfig?.reference?.apiJson !== undefined ||
      record.sourceConfig?.reference?.html !== undefined ||
      record.sourceConfig?.reference?.ical !== undefined;
    if (!hasEvents && !hasFixture) {
      issues.push({
        code: 'incomplete_configuration',
        field: 'sourceConfig.reference',
        message: 'Manual sources require configured reference events or fixture payloads.',
      });
    }
    return issues;
  }

  if (connectorKey === 'open_data_api') {
    if (!record.sourceConfig?.api?.fieldMapping) {
      issues.push({
        code: 'incomplete_configuration',
        field: 'sourceConfig.api.fieldMapping',
        message: 'Open data API sources require field mapping configuration.',
      });
    }
  }

  const url = record.baseUrl ?? record.website;
  if (!url && !record.sourceConfig?.reference) {
    issues.push({
      code: 'incomplete_configuration',
      field: 'baseUrl',
      message: 'Remote sources require a base URL or embedded reference payload.',
    });
  }

  return issues;
}

export function validateSourceRecord(
  input: SourceInput & {
    sourceConfig?: SourceRecord['sourceConfig'];
    category?: string;
    status?: string;
    connectorKey?: string;
    countryCode?: string;
    region?: string;
    stateCode?: string;
    city?: string;
    genreNames?: string[];
    organizerId?: string;
    organizerName?: string;
    venueId?: string;
    venueName?: string;
    tags?: string[];
    languageCode?: string;
    autoEnabled?: boolean;
  },
): SourceValidationResult {
  const issues: SourceValidationIssue[] = [];

  try {
    validateSourceInput(input);
  } catch (error) {
    issues.push({
      code: 'required_field',
      message: error instanceof Error ? error.message : 'Source validation failed.',
    });
  }

  if (!input.displayName?.trim()) {
    issues.push({
      code: 'required_field',
      field: 'displayName',
      message: 'Display name is required.',
    });
  }

  if (input.category !== undefined && input.category !== '' && !isSourceCategory(input.category)) {
    issues.push({
      code: 'invalid_category',
      field: 'category',
      message: 'Category is not a valid source category.',
    });
  }

  if (input.status !== undefined && input.status !== '' && !isSourceManagementStatus(input.status)) {
    issues.push({
      code: 'invalid_status',
      field: 'status',
      message: 'Status is not a valid source management status.',
    });
  }

  const connectorKey = input.connectorKey ?? resolveConnectorKey(input as SourceRecord);
  if (connectorKey && !(SOURCE_CONNECTOR_KEYS as readonly string[]).includes(connectorKey)) {
    issues.push({
      code: 'invalid_connector',
      field: 'connectorKey',
      message: `Connector "${connectorKey}" is not registered.`,
    });
  }

  const baseUrl = input.baseUrl?.trim();
  if (baseUrl && !isValidHttpUrl(baseUrl)) {
    issues.push({
      code: 'invalid_url',
      field: 'baseUrl',
      message: 'Base URL must be a valid http or https URL.',
    });
  }

  const website = input.website?.trim();
  if (website && !isValidHttpUrl(website)) {
    issues.push({
      code: 'invalid_url',
      field: 'website',
      message: 'Website must be a valid http or https URL.',
    });
  }

  if (input.archived && input.enabled) {
    issues.push({
      code: 'archived_enabled_conflict',
      field: 'enabled',
      message: 'Archived sources cannot be enabled.',
    });
  }

  issues.push(
    ...validateConfigurationCompleteness(input as SourceRecord, connectorKey),
  );

  const deduped = issues.filter(
    (issue, index, all) =>
      all.findIndex((candidate) => candidate.field === issue.field && candidate.message === issue.message) === index,
  );

  return {
    valid: deduped.length === 0,
    issues: deduped,
  };
}

export function resolveRecordConnectorKey(record: SourceRecord): SourceConnectorKey | undefined {
  const key = resolveConnectorKey(record);
  if (key && (SOURCE_CONNECTOR_KEYS as readonly string[]).includes(key)) {
    return key as SourceConnectorKey;
  }
  return undefined;
}

export function resolveRecordCategory(record: SourceRecord): SourceCategory {
  return inferSourceCategory({
    category: record.category,
    sourceType: record.sourceType,
    parserType: record.parserType,
    connectorKey: resolveConnectorKey(record),
  });
}

export function resolveRecordStatus(record: SourceRecord): SourceManagementStatus {
  if (record.status && isSourceManagementStatus(record.status)) {
    return record.status;
  }
  if (record.archived) return 'archived';
  if ((record.consecutiveFailureCount ?? 0) >= 3) return 'error';
  if (record.enabled) return 'active';
  return record.reviewRequired === false && !record.lastImportAt ? 'draft' : 'disabled';
}
