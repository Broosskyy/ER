export const IMPORT_JOB_STATUSES = [
  'pending',
  'running',
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
] as const;

export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

export const IMPORT_RECORD_STATUSES = [
  'fetched',
  'parsed',
  'needs_review',
  'invalid',
  'duplicate',
  'approved',
  'rejected',
  'imported',
] as const;

export type ImportRecordStatus = (typeof IMPORT_RECORD_STATUSES)[number];

export const IMPORT_TRIGGER_TYPES = ['manual', 'scheduled', 'webhook'] as const;

export type ImportTriggerType = (typeof IMPORT_TRIGGER_TYPES)[number];

export const IMPORT_LOG_LEVELS = ['debug', 'info', 'warning', 'error'] as const;

export type ImportLogLevel = (typeof IMPORT_LOG_LEVELS)[number];

export const DUPLICATE_DECISIONS = ['confirmed', 'dismissed', 'override'] as const;

export type DuplicateDecision = (typeof DUPLICATE_DECISIONS)[number];

export const REJECT_REASONS = [
  'not_relevant',
  'incomplete_data',
  'invalid_data',
  'outdated_event',
  'wrong_region',
  'spam',
  'source_error',
  'other',
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

export function isImportJobStatus(value: string): value is ImportJobStatus {
  return (IMPORT_JOB_STATUSES as readonly string[]).includes(value);
}

export function isImportRecordStatus(value: string): value is ImportRecordStatus {
  return (IMPORT_RECORD_STATUSES as readonly string[]).includes(value);
}

export function isImportTriggerType(value: string): value is ImportTriggerType {
  return (IMPORT_TRIGGER_TYPES as readonly string[]).includes(value);
}

export function isRejectReason(value: string): value is RejectReason {
  return (REJECT_REASONS as readonly string[]).includes(value);
}
