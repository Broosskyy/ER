import { classifyIngestionError, isRetryableErrorCategory } from './error-taxonomy';
import type { IngestionErrorCategory } from './types';

export interface RetryPolicyConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  maxAttempts: 3,
  initialDelayMs: 250,
  maxDelayMs: 4_000,
  backoffMultiplier: 2,
};

export interface RetryExecutionResult<T> {
  result?: T;
  attempts: number;
  errorCategory?: IngestionErrorCategory;
  errorMessage?: string;
}

export function computeRetryDelayMs(attempt: number, policy: RetryPolicyConfig): number {
  const delay = policy.initialDelayMs * policy.backoffMultiplier ** Math.max(0, attempt - 1);
  return Math.min(delay, policy.maxDelayMs);
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicyConfig = DEFAULT_RETRY_POLICY,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<RetryExecutionResult<T>> {
  let lastCategory: IngestionErrorCategory | undefined;
  let lastMessage: string | undefined;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      const result = await operation();
      return { result, attempts: attempt };
    } catch (error) {
      const classified = classifyIngestionError(error);
      lastCategory = classified.category;
      lastMessage = classified.message;

      const canRetry = isRetryableErrorCategory(classified.category) && attempt < policy.maxAttempts;
      if (!canRetry) {
        return {
          attempts: attempt,
          errorCategory: classified.category,
          errorMessage: classified.message,
        };
      }

      await sleep(computeRetryDelayMs(attempt, policy));
    }
  }

  return {
    attempts: policy.maxAttempts,
    errorCategory: lastCategory,
    errorMessage: lastMessage,
  };
}
