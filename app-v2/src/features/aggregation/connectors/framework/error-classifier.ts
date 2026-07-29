import { ImportExecutionError } from '@/features/import/errors/import-errors';
import {
  createSourceConnectorErrorDetail,
  type SourceConnectorErrorCode,
  type SourceConnectorErrorDetail,
} from '@/features/aggregation/connectors/framework/errors';

export function classifySourceConnectorError(error: unknown): SourceConnectorErrorDetail {
  if (error instanceof ImportExecutionError) {
    if (error.code === 'IMPORT_TIMEOUT') {
      return createSourceConnectorErrorDetail('timeout', error.message, { retryable: true });
    }

    const message = error.message.toLowerCase();

    if (message.includes('http 401') || message.includes('unauthorized')) {
      return createSourceConnectorErrorDetail('authentication_failed', error.message, {
        retryable: false,
      });
    }
    if (message.includes('http 403') || message.includes('forbidden')) {
      return createSourceConnectorErrorDetail('authentication_failed', error.message, {
        retryable: false,
      });
    }
    if (message.includes('http 400') || message.includes('bad request')) {
      return createSourceConnectorErrorDetail('configuration_invalid', error.message, {
        retryable: false,
      });
    }
    if (message.includes('http 429') || message.includes('rate limit')) {
      return createSourceConnectorErrorDetail('rate_limited', error.message, {
        retryable: true,
        retryAfterMs: 5_000,
      });
    }
    if (message.includes('http 503') || message.includes('maintenance')) {
      return createSourceConnectorErrorDetail('maintenance', error.message, { retryable: true });
    }
    if (/http 5\d\d/.test(message)) {
      return createSourceConnectorErrorDetail('upstream_unavailable', error.message, {
        retryable: true,
      });
    }
    if (message.includes('invalid url') || message.includes('blocked')) {
      return createSourceConnectorErrorDetail('configuration_invalid', error.message, {
        retryable: false,
      });
    }
    if (message.includes('unexpected content type') || message.includes('parse')) {
      return createSourceConnectorErrorDetail('schema_invalid', error.message, { retryable: false });
    }

    return createSourceConnectorErrorDetail('upstream_unavailable', error.message, {
      retryable: true,
    });
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.toLowerCase().includes('timed out')) {
      return createSourceConnectorErrorDetail('timeout', error.message, { retryable: true });
    }
    if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('fetch')) {
      return createSourceConnectorErrorDetail('network_error', error.message, { retryable: true });
    }
    if (error.message.toLowerCase().includes('mapping')) {
      return createSourceConnectorErrorDetail('mapping_failed', error.message, { retryable: false });
    }
  }

  return createSourceConnectorErrorDetail(
    'upstream_unavailable',
    error instanceof Error ? error.message : 'Unknown connector failure.',
    { retryable: true },
  );
}

export function isRetryableConnectorFailure(detail: SourceConnectorErrorDetail): boolean {
  return detail.retryable;
}

export function toSourceConnectorErrorCode(value: string): SourceConnectorErrorCode | undefined {
  const normalized = value as SourceConnectorErrorCode;
  return [
    'authentication_failed',
    'timeout',
    'network_error',
    'rate_limited',
    'schema_invalid',
    'mapping_failed',
    'upstream_unavailable',
    'maintenance',
    'configuration_invalid',
  ].includes(normalized)
    ? normalized
    : undefined;
}
