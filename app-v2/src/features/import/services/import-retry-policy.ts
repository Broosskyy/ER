export type ImportFailureCategory =
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'authentication'
  | 'authorization'
  | 'configuration'
  | 'parsing'
  | 'normalization'
  | 'validation'
  | 'duplicate'
  | 'merge'
  | 'persistence'
  | 'consumer_refresh'
  | 'unknown';

export interface ImportFailure {
  category: ImportFailureCategory;
  retryAfterMs?: number;
}

export interface RetryDecision {
  retryable: boolean;
  delayMs?: number;
  reason: string;
}

export const IMPORT_RETRY_POLICY = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
} as const;

export function resolveImportRetry(
  failure: ImportFailure,
  attempt: number,
  now = Date.now(),
): RetryDecision {
  const retryable = ['network', 'timeout', 'rate_limit', 'persistence', 'consumer_refresh', 'unknown']
    .includes(failure.category);
  if (!retryable || attempt >= IMPORT_RETRY_POLICY.maxAttempts) {
    return { retryable: false, reason: 'Failure category or attempt limit does not permit retry.' };
  }

  const exponentialDelay = Math.min(
    IMPORT_RETRY_POLICY.maxDelayMs,
    IMPORT_RETRY_POLICY.baseDelayMs * 2 ** Math.max(0, attempt - 1),
  );
  const deterministicJitter = now % 251;
  return {
    retryable: true,
    delayMs: Math.max(failure.retryAfterMs ?? 0, exponentialDelay + deterministicJitter),
    reason: 'Retryable transient import failure.',
  };
}

export class InMemorySourceImportLock {
  private readonly lockedSourceIds = new Set<string>();

  acquire(sourceId: string): boolean {
    if (this.lockedSourceIds.has(sourceId)) return false;
    this.lockedSourceIds.add(sourceId);
    return true;
  }

  release(sourceId: string): void {
    this.lockedSourceIds.delete(sourceId);
  }
}
