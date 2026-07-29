import type { SourceConnectorRetryConfig } from '@/features/aggregation/connectors/framework/config';
import type { SourceConnectorErrorDetail } from '@/features/aggregation/connectors/framework/errors';
import { isRetryableConnectorFailure } from '@/features/aggregation/connectors/framework/error-classifier';

export interface SourceConnectorRetryDecision {
  retryable: boolean;
  delayMs?: number;
  reason: string;
}

export interface SourceConnectorRetryMetadata {
  attempt: number;
  maxRetries: number;
  delayMs?: number;
  errorCode?: string;
  completedAt: string;
}

export function resolveSourceConnectorRetry(
  failure: SourceConnectorErrorDetail,
  attempt: number,
  config: SourceConnectorRetryConfig,
  now = Date.now(),
): SourceConnectorRetryDecision {
  if (!isRetryableConnectorFailure(failure) || attempt > config.maxRetries) {
    return {
      retryable: false,
      reason: 'Failure is not retryable or retry limit reached.',
    };
  }

  const exponentialDelay = Math.min(
    config.maxDelayMs,
    config.baseDelayMs * 2 ** Math.max(0, attempt - 1),
  );
  const jitter = now % 251;
  const cooldownDelay = failure.retryAfterMs ?? 0;

  return {
    retryable: true,
    delayMs: Math.max(cooldownDelay, exponentialDelay + jitter),
    reason: 'Transient connector failure — retry scheduled.',
  };
}

export function buildRetryMetadata(
  attempt: number,
  config: SourceConnectorRetryConfig,
  failure: SourceConnectorErrorDetail,
  delayMs?: number,
): SourceConnectorRetryMetadata {
  return {
    attempt,
    maxRetries: config.maxRetries,
    delayMs,
    errorCode: failure.code,
    completedAt: new Date().toISOString(),
  };
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
