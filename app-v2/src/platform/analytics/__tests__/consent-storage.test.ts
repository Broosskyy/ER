import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acceptAnalyticsConsent,
  readConsentState,
  rejectOptionalConsent,
  revokeAnalyticsConsent,
} from '@/platform/analytics/consent-storage';
import { CONSENT_STORAGE_KEY } from '@/platform/analytics/consent-types';

function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('consent-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
  });

  it('returns null when no consent saved', () => {
    expect(readConsentState()).toBeNull();
  });

  it('stores analytics opt-in', () => {
    const state = acceptAnalyticsConsent();
    expect(state.analytics).toBe('granted');
    expect(readConsentState()?.analytics).toBe('granted');
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toContain('granted');
  });

  it('defaults analytics to denied on reject', () => {
    const state = rejectOptionalConsent();
    expect(state.analytics).toBe('denied');
    expect(state.marketing).toBe('denied');
  });

  it('revokes analytics consent', () => {
    acceptAnalyticsConsent();
    const state = revokeAnalyticsConsent();
    expect(state.analytics).toBe('denied');
  });
});
