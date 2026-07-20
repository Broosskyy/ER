import { describe, expect, it } from 'vitest';

import {
  FALLBACK_LOCALE,
  getIntlLocale,
  normalizeLocale,
  resolveLocalePreference,
} from '@/features/i18n/locale';

describe('locale normalization', () => {
  it('normalizes supported german and english tags', () => {
    expect(normalizeLocale('de-DE')).toBe('de');
    expect(normalizeLocale('de-AT')).toBe('de');
    expect(normalizeLocale('de-CH')).toBe('de');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('en-GB')).toBe('en');
  });

  it('falls back for unknown locales', () => {
    expect(normalizeLocale('fr-FR')).toBe(FALLBACK_LOCALE);
    expect(normalizeLocale(null)).toBe(FALLBACK_LOCALE);
  });

  it('resolves locale preference with stored value first', () => {
    expect(resolveLocalePreference('en', 'de-DE')).toBe('en');
    expect(resolveLocalePreference(null, 'en-US')).toBe('en');
    expect(resolveLocalePreference(null, 'fr-FR')).toBe(FALLBACK_LOCALE);
  });

  it('maps app locales to intl locales', () => {
    expect(getIntlLocale('de')).toBe('de-DE');
    expect(getIntlLocale('en')).toBe('en-GB');
  });
});
