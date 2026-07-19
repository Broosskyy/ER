export const VALIDATION_ERROR_CODES = [
  'TITLE_MISSING',
  'START_DATE_MISSING',
  'START_DATE_INVALID',
  'END_DATE_INVALID',
  'END_DATE_BEFORE_START',
  'LOCATION_MISSING',
  'URL_INVALID',
  'COORDINATES_INVALID',
  'TIMEZONE_MISSING',
  'FIELD_TOO_LONG',
  'COUNTRY_CODE_INVALID',
  'MINIMUM_AGE_INVALID',
  'PAYLOAD_TYPE_INVALID',
] as const;

export const VALIDATION_WARNING_CODES = [
  'TIMEZONE_MISSING',
  'END_DATE_MISSING',
  'DESCRIPTION_MISSING',
  'URL_INVALID',
  'FIELD_TRUNCATED',
] as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[number];
export type ValidationWarningCode = (typeof VALIDATION_WARNING_CODES)[number];

export interface ValidationIssue {
  code: ValidationErrorCode | ValidationWarningCode | string;
  field?: string;
  message: string;
}

export interface CandidateValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  normalizedCandidate?: import('../models/normalized-event-candidate').NormalizedEventCandidate;
}
