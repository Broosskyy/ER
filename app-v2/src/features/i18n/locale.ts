export const FALLBACK_LOCALE = 'de' as const;
export const SUPPORTED_LOCALES = ['de', 'en'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(input: string | null | undefined): AppLocale {
  if (!input) {
    return FALLBACK_LOCALE;
  }

  const base = input.split('-')[0]?.toLowerCase();

  if (base === 'en') {
    return 'en';
  }

  if (base === 'de') {
    return 'de';
  }

  return FALLBACK_LOCALE;
}

export function resolveLocalePreference(
  stored: AppLocale | null,
  deviceTag: string | null | undefined,
): AppLocale {
  if (stored) {
    return stored;
  }

  return normalizeLocale(deviceTag);
}

export function getIntlLocale(locale: AppLocale): string {
  return locale === 'en' ? 'en-GB' : 'de-DE';
}

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'de' || value === 'en';
}
