import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getIntlLocale, type AppLocale } from '@/features/i18n/locale';

export function useAppTranslation() {
  return useTranslation();
}

export function useAppLocale(): AppLocale {
  const { i18n } = useAppTranslation();
  return i18n.language === 'en' ? 'en' : 'de';
}

export function useIntlLocale(): string {
  const locale = useAppLocale();
  return useMemo(() => getIntlLocale(locale), [locale]);
}

export function formatAppDate(date: Date, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(date);
}

export function formatAppDateTime(date: Date, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatAppNumber(value: number, intlLocale: string): string {
  return new Intl.NumberFormat(intlLocale).format(value);
}
