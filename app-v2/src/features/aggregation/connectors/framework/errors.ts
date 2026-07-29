export const SOURCE_CONNECTOR_ERROR_CODES = [
  'authentication_failed',
  'timeout',
  'network_error',
  'rate_limited',
  'schema_invalid',
  'mapping_failed',
  'upstream_unavailable',
  'maintenance',
  'configuration_invalid',
] as const;

export type SourceConnectorErrorCode = (typeof SOURCE_CONNECTOR_ERROR_CODES)[number];

export interface SourceConnectorErrorDetail {
  code: SourceConnectorErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  metadata?: Record<string, unknown>;
}

export class SourceConnectorError extends Error {
  readonly code: SourceConnectorErrorCode;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly metadata?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(detail: SourceConnectorErrorDetail, cause?: unknown) {
    super(detail.message);
    this.name = 'SourceConnectorError';
    this.code = detail.code;
    this.retryable = detail.retryable;
    this.retryAfterMs = detail.retryAfterMs;
    this.metadata = detail.metadata;
    this.cause = cause;
  }
}

export function createSourceConnectorErrorDetail(
  code: SourceConnectorErrorCode,
  message: string,
  options: {
    retryable?: boolean;
    retryAfterMs?: number;
    metadata?: Record<string, unknown>;
  } = {},
): SourceConnectorErrorDetail {
  return {
    code,
    message,
    retryable: options.retryable ?? isRetryableSourceConnectorError(code),
    retryAfterMs: options.retryAfterMs,
    metadata: options.metadata,
  };
}

export function isRetryableSourceConnectorError(code: SourceConnectorErrorCode): boolean {
  return [
    'timeout',
    'network_error',
    'rate_limited',
    'upstream_unavailable',
    'maintenance',
  ].includes(code);
}
