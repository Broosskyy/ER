import { de } from '@/features/i18n/locales/de';
import { en } from '@/features/i18n/locales/en';

export const resources = {
  de: { translation: de },
  en: { translation: en },
} as const;

export const REQUIRED_TRANSLATION_KEYS = [
  'common.actions.login',
  'common.actions.register',
  'common.actions.logout',
  'auth.login.title',
  'auth.register.title',
  'auth.register.checkEmail',
  'profile.account.title',
  'create.title',
  'create.subtitle',
  'create.options.event.title',
  'create.event.form.title',
  'create.event.form.actions.saveDraft',
  'create.event.success.title',
  'create.options.organizer.title',
  'create.options.venue.title',
  'create.options.artist.title',
  'create.options.account.title',
  'activity.title',
  'activity.emptyTitle',
  'activity.loading',
  'activity.errorTitle',
  'home.header.create',
] as const;

function collectLeafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
      return collectLeafPaths(nested, nextPrefix);
    }
    return [nextPrefix];
  });
}

export function getTranslationLeafPaths(locale: 'de' | 'en'): string[] {
  const tree = locale === 'de' ? de : en;
  return collectLeafPaths(tree).sort();
}

export function getMissingRequiredKeys(locale: 'de' | 'en'): string[] {
  const available = new Set(getTranslationLeafPaths(locale));
  return REQUIRED_TRANSLATION_KEYS.filter((key) => !available.has(key));
}
