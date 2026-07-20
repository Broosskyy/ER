export { I18nProvider } from '@/features/i18n/I18nProvider';
export { changeAppLocale, i18n, initI18n } from '@/features/i18n/i18n';
export {
  FALLBACK_LOCALE,
  getIntlLocale,
  isAppLocale,
  normalizeLocale,
  resolveLocalePreference,
  SUPPORTED_LOCALES,
} from '@/features/i18n/locale';
export type { AppLocale } from '@/features/i18n/locale';
export { LOCALE_STORAGE_KEY, loadLocalePreference, saveLocalePreference } from '@/features/i18n/locale-storage';
export {
  getMissingRequiredKeys,
  getTranslationLeafPaths,
  REQUIRED_TRANSLATION_KEYS,
  resources,
} from '@/features/i18n/resources';
export { resolveAuthErrorTranslationKey, translateAuthError } from '@/features/i18n/auth-errors';
export {
  formatAppDate,
  formatAppDateTime,
  formatAppNumber,
  useAppLocale,
  useAppTranslation,
  useIntlLocale,
} from '@/features/i18n/useAppTranslation';
export { useWebPageTitle } from '@/features/i18n/useWebPageTitle';
export { LanguageSwitcher } from '@/features/i18n/components/LanguageSwitcher';
