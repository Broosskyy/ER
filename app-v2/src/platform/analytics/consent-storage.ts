import {
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT_STATE,
  type ConsentState,
} from '@/platform/analytics/consent-types';

function isConsentState(value: unknown): value is ConsentState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const state = value as ConsentState;
  return (
    state.version === 1 &&
    state.necessary === 'granted' &&
    (state.analytics === 'granted' || state.analytics === 'denied') &&
    (state.marketing === 'granted' || state.marketing === 'denied')
  );
}

export function readConsentState(): ConsentState | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return isConsentState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeConsentState(state: ConsentState): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
}

export function clearConsentState(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.removeItem(CONSENT_STORAGE_KEY);
}

export function acceptAnalyticsConsent(): ConsentState {
  const state: ConsentState = {
    ...DEFAULT_CONSENT_STATE,
    analytics: 'granted',
    updatedAt: new Date().toISOString(),
  };
  writeConsentState(state);
  return state;
}

export function rejectOptionalConsent(): ConsentState {
  const state: ConsentState = {
    ...DEFAULT_CONSENT_STATE,
    updatedAt: new Date().toISOString(),
  };
  writeConsentState(state);
  return state;
}

export function revokeAnalyticsConsent(): ConsentState {
  return rejectOptionalConsent();
}
