import type { SourceConnectorErrorDetail } from '@/features/aggregation/connectors/framework/errors';

export interface SourceConnectorDiagnosticsWarning {
  code: string;
  message: string;
  field?: string;
  metadata?: Record<string, unknown>;
}

export interface SourceConnectorMappingIssue {
  field: string;
  message: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface SourceConnectorDiagnostics {
  durationMs: number;
  eventCount: number;
  errors: SourceConnectorErrorDetail[];
  warnings: SourceConnectorDiagnosticsWarning[];
  skippedRecords: number;
  mappingIssues: SourceConnectorMappingIssue[];
  apiVersion?: string;
  connectorVersion: string;
  schemaVersion: string;
  retryAttempts: number;
  rateLimited: boolean;
}

export function createEmptyDiagnostics(
  version: { connectorVersion: string; schemaVersion: string },
): SourceConnectorDiagnostics {
  return {
    durationMs: 0,
    eventCount: 0,
    errors: [],
    warnings: [],
    skippedRecords: 0,
    mappingIssues: [],
    connectorVersion: version.connectorVersion,
    schemaVersion: version.schemaVersion,
    retryAttempts: 0,
    rateLimited: false,
  };
}

export function detectMappingIssues(
  events: Array<{ externalId: string; title?: string; startDate?: string }>,
): SourceConnectorMappingIssue[] {
  const issues: SourceConnectorMappingIssue[] = [];

  for (const event of events) {
    if (!event.title?.trim()) {
      issues.push({
        field: 'title',
        message: 'Missing title after mapping.',
        externalId: event.externalId,
      });
    }
    if (!event.startDate?.trim()) {
      issues.push({
        field: 'startDate',
        message: 'Missing start date after mapping.',
        externalId: event.externalId,
      });
    }
  }

  return issues;
}
