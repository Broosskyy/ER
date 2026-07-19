export type ConsentCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

export type ConsentValue = 'granted' | 'denied';

export interface ConsentState {
  necessary: ConsentValue;
  functional: ConsentValue;
  analytics: ConsentValue;
  marketing: ConsentValue;
  updatedAt: string;
  version: 1;
}

export const CONSENT_STORAGE_KEY = '@eternal_rave/analytics_consent_v1';

/** Privacy-by-default: deny optional categories until explicit opt-in. */
export const DEFAULT_CONSENT_STATE: ConsentState = {
  necessary: 'granted',
  functional: 'granted',
  analytics: 'denied',
  marketing: 'denied',
  updatedAt: new Date(0).toISOString(),
  version: 1,
};

export const CONSENT_MODE_DEFAULTS = {
  analytics_storage: 'denied' as ConsentValue,
  ad_storage: 'denied' as ConsentValue,
  ad_user_data: 'denied' as ConsentValue,
  ad_personalization: 'denied' as ConsentValue,
};

export function consentStateToGtag(consent: ConsentState): Record<string, ConsentValue> {
  return {
    analytics_storage: consent.analytics,
    ad_storage: consent.marketing,
    ad_user_data: consent.marketing,
    ad_personalization: consent.marketing,
  };
}
