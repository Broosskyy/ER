import { describe, expect, it } from 'vitest';

import {
  assertShadowNoWrite,
  deliberateWriteAttemptShouldFail,
  recordShadowWriteAttempt,
  resetShadowWriteAttempts,
  wrapClientForShadowReadOnly,
} from '@/features/import/shadow/shadow-no-write-guard';

describe('shadow-no-write-guard', () => {
  it('blocks deliberate write attempts', () => {
    resetShadowWriteAttempts();
    expect(deliberateWriteAttemptShouldFail()).toBe(true);
    const guard = assertShadowNoWrite({ productionMutationsInThisRun: 0 });
    expect(guard.ok).toBe(true);
  });

  it('records blocked writes and fails assert', () => {
    resetShadowWriteAttempts();
    try {
      recordShadowWriteAttempt('insert', 'events');
    } catch {
      // expected
    }
    const guard = assertShadowNoWrite({ productionMutationsInThisRun: 0 });
    expect(guard.ok).toBe(false);
    expect(guard.violations.length).toBeGreaterThan(0);
  });

  it('wraps client so from().insert throws', () => {
    resetShadowWriteAttempts();
    const fake = wrapClientForShadowReadOnly({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    });
    expect(() => fake.from('events').insert({})).toThrow();
  });
});
