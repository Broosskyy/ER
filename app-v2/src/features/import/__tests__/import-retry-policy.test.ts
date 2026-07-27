import { describe, expect, it } from 'vitest';

import {
  InMemorySourceImportLock,
  resolveImportRetry,
} from '@/features/import/services/import-retry-policy';

describe('import retry policy', () => {
  it('retries transient network failures with bounded backoff', () => {
    const decision = resolveImportRetry({ category: 'network' }, 1, 100);
    expect(decision.retryable).toBe(true);
    expect(decision.delayMs).toBeGreaterThanOrEqual(1_000);
  });

  it('does not retry configuration errors', () => {
    expect(resolveImportRetry({ category: 'configuration' }, 1).retryable).toBe(false);
  });

  it('prevents concurrent imports of the same source locally', () => {
    const lock = new InMemorySourceImportLock();
    expect(lock.acquire('source-1')).toBe(true);
    expect(lock.acquire('source-1')).toBe(false);
    lock.release('source-1');
    expect(lock.acquire('source-1')).toBe(true);
  });
});
