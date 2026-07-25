export const CONNECTOR_ERROR_CATEGORIES = [
  'configuration',
  'authentication',
  'connectivity',
  'parsing',
  'timeout',
  'rate_limit',
  'unknown',
] as const;

export type ConnectorErrorCategory = (typeof CONNECTOR_ERROR_CATEGORIES)[number];

export type ConnectorErrorCode =
  | 'CONNECTOR_UNKNOWN'
  | 'CONNECTOR_NOT_FOUND'
  | 'CONNECTOR_DUPLICATE'
  | 'CONNECTOR_INVALID'
  | 'CONNECTOR_CONFIGURATION'
  | 'CONNECTOR_VALIDATION'
  | 'CONNECTOR_EXECUTION';

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly category: ConnectorErrorCategory;
  readonly cause?: unknown;

  constructor(
    message: string,
    code: ConnectorErrorCode = 'CONNECTOR_UNKNOWN',
    category: ConnectorErrorCategory = 'unknown',
    cause?: unknown,
  ) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
    this.category = category;
    this.cause = cause;
  }
}

export class ConnectorRegistryError extends ConnectorError {
  constructor(
    message: string,
    code: Extract<ConnectorErrorCode, 'CONNECTOR_NOT_FOUND' | 'CONNECTOR_DUPLICATE' | 'CONNECTOR_INVALID'>,
    cause?: unknown,
  ) {
    super(message, code, 'configuration', cause);
    this.name = 'ConnectorRegistryError';
  }
}

export class ConnectorValidationError extends ConnectorError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CONNECTOR_VALIDATION', 'configuration', cause);
    this.name = 'ConnectorValidationError';
  }
}

export class ConnectorExecutionError extends ConnectorError {
  constructor(
    message: string,
    category: ConnectorErrorCategory = 'unknown',
    cause?: unknown,
  ) {
    super(message, 'CONNECTOR_EXECUTION', category, cause);
    this.name = 'ConnectorExecutionError';
  }
}

export interface ConnectorErrorDetail {
  category: ConnectorErrorCategory;
  code: string;
  message: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
}

export function createConnectorErrorDetail(
  category: ConnectorErrorCategory,
  code: string,
  message: string,
  options: { retryable?: boolean; metadata?: Record<string, unknown> } = {},
): ConnectorErrorDetail {
  return {
    category,
    code,
    message,
    retryable: options.retryable,
    metadata: options.metadata,
  };
}
