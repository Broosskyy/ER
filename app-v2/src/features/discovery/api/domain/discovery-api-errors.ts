export const DISCOVERY_API_ERROR_CODES = [
  'INVALID_FILTER',
  'INVALID_CURSOR',
  'INVALID_SORT',
  'INVALID_QUERY',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'VERSION_NOT_SUPPORTED',
] as const;

export type DiscoveryApiErrorCode = (typeof DISCOVERY_API_ERROR_CODES)[number];

export interface DiscoveryApiErrorDetail {
  field?: string;
  code: DiscoveryApiErrorCode;
  message: string;
}

export class DiscoveryApiError extends Error {
  readonly status: number;
  readonly code: DiscoveryApiErrorCode;
  readonly details: DiscoveryApiErrorDetail[];
  readonly retryable: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: DiscoveryApiErrorCode;
      details?: DiscoveryApiErrorDetail[];
      retryable?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'DiscoveryApiError';
    this.status = options.status ?? mapDiscoveryApiErrorStatus(options.code ?? 'INTERNAL_ERROR');
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = options.details ?? [];
    this.retryable = options.retryable ?? false;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function mapDiscoveryApiErrorStatus(code: DiscoveryApiErrorCode): number {
  switch (code) {
    case 'INVALID_FILTER':
    case 'INVALID_CURSOR':
    case 'INVALID_SORT':
    case 'INVALID_QUERY':
    case 'VERSION_NOT_SUPPORTED':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'RATE_LIMITED':
      return 429;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}

export function isDiscoveryApiError(error: unknown): error is DiscoveryApiError {
  return error instanceof DiscoveryApiError;
}
