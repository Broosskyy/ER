import type {
  ImportJobStatus,
  ImportLogLevel,
  ImportRecordStatus,
  ImportTriggerType,
} from './statuses';
import type { ImportSourceConfig } from './source-config';
import type { ValidationIssue } from '@/features/import/validation/validation-codes';

export interface ImportSource {
  id: string;
  name: string;
  type: string;
  website?: string;
  sourceUrl?: string;
  sourceConfig?: ImportSourceConfig;
  defaultTimezone?: string;
  trustScore: number;
  active: boolean;
  adapterKey?: string;
}

export interface ImportJobMetrics {
  fetchedCount: number;
  parsedCount: number;
  invalidCount: number;
  warningCount: number;
  errorCount: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
}

export interface ImportJob {
  id: string;
  sourceId: string;
  status: ImportJobStatus;
  triggerType: ImportTriggerType;
  startedAt?: string;
  finishedAt?: string;
  errorSummary?: string;
  metrics: ImportJobMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRecord {
  id: string;
  importJobId: string;
  sourceId: string;
  externalId: string;
  sourceUrl?: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
  validationErrors?: ValidationIssue[];
  validationWarnings?: ValidationIssue[];
  status: ImportRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ImportLog {
  id: string;
  importJobId: string;
  importRecordId?: string;
  level: ImportLogLevel;
  code: string;
  message: string;
  createdAt: string;
}

export interface CreateImportJobInput {
  sourceId: string;
  triggerType: ImportTriggerType;
  status?: ImportJobStatus;
}

export interface CreateImportRecordInput {
  importJobId: string;
  sourceId: string;
  externalId: string;
  sourceUrl?: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
  validationErrors?: ValidationIssue[];
  validationWarnings?: ValidationIssue[];
  status?: ImportRecordStatus;
}

export interface CreateImportLogInput {
  importJobId: string;
  importRecordId?: string;
  level: ImportLogLevel;
  code: string;
  message: string;
}

export function createEmptyJobMetrics(): ImportJobMetrics {
  return {
    fetchedCount: 0,
    parsedCount: 0,
    invalidCount: 0,
    warningCount: 0,
    errorCount: 0,
    createdCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
  };
}
