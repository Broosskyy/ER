export type ImportErrorCode =
  | 'IMPORT_UNKNOWN'
  | 'IMPORT_REPOSITORY'
  | 'IMPORT_ADAPTER_NOT_FOUND'
  | 'IMPORT_ADAPTER_DUPLICATE'
  | 'IMPORT_ADAPTER_INVALID'
  | 'IMPORT_EXECUTION_FAILED'
  | 'IMPORT_SOURCE_NOT_FOUND'
  | 'IMPORT_SOURCE_INACTIVE'
  | 'IMPORT_JOB_NOT_FOUND'
  | 'IMPORT_RECORD_LIMIT_EXCEEDED'
  | 'IMPORT_TIMEOUT'
  | 'CITY_MATCH_FAILED'
  | 'VENUE_MATCH_FAILED'
  | 'ARTIST_MATCH_FAILED'
  | 'GENRE_MATCH_FAILED'
  | 'DUPLICATE_CHECK_FAILED'
  | 'IMPORT_CONCURRENCY_CONFLICT'
  | 'IMPORT_PERMISSION_DENIED'
  | 'IMPORT_VALIDATION_BLOCKED'
  | 'IMPORT_ACTIVE_JOB_EXISTS'
  | 'IMPORT_RECORD_NOT_REVIEWABLE'
  | 'IMPORT_EVENT_CREATE_FAILED'
  | 'IMPORT_DUPLICATE_UNRESOLVED';

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: ImportErrorCode = 'IMPORT_UNKNOWN', cause?: unknown) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.cause = cause;
  }
}

export class ImportRepositoryError extends ImportError {
  constructor(message: string, cause?: unknown) {
    super(message, 'IMPORT_REPOSITORY', cause);
    this.name = 'ImportRepositoryError';
  }
}

export class ImportAdapterError extends ImportError {
  constructor(
    message: string,
    code: Extract<
      ImportErrorCode,
      'IMPORT_ADAPTER_NOT_FOUND' | 'IMPORT_ADAPTER_DUPLICATE' | 'IMPORT_ADAPTER_INVALID'
    >,
    cause?: unknown,
  ) {
    super(message, code, cause);
    this.name = 'ImportAdapterError';
  }
}

export class ImportExecutionError extends ImportError {
  constructor(
    message: string,
    code: Extract<
      ImportErrorCode,
      'IMPORT_EXECUTION_FAILED' | 'IMPORT_TIMEOUT' | 'IMPORT_RECORD_LIMIT_EXCEEDED'
    > = 'IMPORT_EXECUTION_FAILED',
    cause?: unknown,
  ) {
    super(message, code, cause);
    this.name = 'ImportExecutionError';
  }
}

export class ImportMatchingError extends ImportError {
  constructor(
    message: string,
    code: Extract<
      ImportErrorCode,
      | 'CITY_MATCH_FAILED'
      | 'VENUE_MATCH_FAILED'
      | 'ARTIST_MATCH_FAILED'
      | 'GENRE_MATCH_FAILED'
      | 'DUPLICATE_CHECK_FAILED'
    >,
    cause?: unknown,
  ) {
    super(message, code, cause);
    this.name = 'ImportMatchingError';
  }
}

export class ImportConcurrencyError extends ImportError {
  constructor(message = 'The record was modified by another user.', cause?: unknown) {
    super(message, 'IMPORT_CONCURRENCY_CONFLICT', cause);
    this.name = 'ImportConcurrencyError';
  }
}

export class ImportPermissionError extends ImportError {
  constructor(message = 'You do not have permission to perform this action.', cause?: unknown) {
    super(message, 'IMPORT_PERMISSION_DENIED', cause);
    this.name = 'ImportPermissionError';
  }
}
