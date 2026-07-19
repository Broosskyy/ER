import type { ImportRecordStatus } from '@/features/import/models/statuses';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import type { MatchResult } from '@/features/import/matching/match-result';
import type { ValidationIssue } from '@/features/import/validation/validation-codes';

export interface ImportAdapterRecordResult {
  externalId: string;
  sourceUrl?: string;
  rawPayload: Record<string, unknown>;
  normalizedCandidate?: NormalizedEventCandidate;
  validationErrors?: ValidationIssue[];
  validationWarnings?: ValidationIssue[];
  matchResult?: MatchResult;
  status: ImportRecordStatus;
  skipped?: boolean;
  skipReason?: string;
}

export interface ImportAdapterRunResult {
  records: ImportAdapterRecordResult[];
  warnings: string[];
  skippedCount: number;
  metadata: Record<string, unknown>;
}

export interface ImportAdapterContext {
  jobId: string;
  log: (level: 'debug' | 'info' | 'warning' | 'error', code: string, message: string) => Promise<void>;
}

export interface ImportSourceAdapter {
  readonly adapterKey: string;
  execute(source: import('@/features/import/models/types').ImportSource, context: ImportAdapterContext): Promise<ImportAdapterRunResult>;
}

/** @deprecated Use execute() — kept for backward-compatible test mocks */
export interface ImportFetchedRecord {
  externalId: string;
  rawPayload: Record<string, unknown>;
}
