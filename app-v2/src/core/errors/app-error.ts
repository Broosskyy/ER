export type AppErrorCode =
  | 'NETWORK'
  | 'OFFLINE'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: { code?: AppErrorCode; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = options.code ?? 'UNKNOWN';
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

export function isRetryableError(error: unknown): boolean {
  return error instanceof AppError && error.retryable;
}
