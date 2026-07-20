import type { UserLocationRecord } from '@/features/location/types/user-location';

export function localizeCountryName(
  country: string | undefined,
  countryCode: string | undefined,
  locale: string,
): string | undefined {
  if (!country && !countryCode) {
    return undefined;
  }

  if (countryCode) {
    try {
      const display = new Intl.DisplayNames([locale], { type: 'region' });
      const localized = display.of(countryCode.toUpperCase());
      if (localized) {
        return localized;
      }
    } catch {
      // fall through to raw country name
    }
  }

  return country;
}

export function formatUserLocationLabel(
  record: Pick<UserLocationRecord, 'city' | 'region' | 'country' | 'countryCode'> | null,
  locale: string,
): string | null {
  if (!record) {
    return null;
  }

  const city = record.city?.trim() || record.region?.trim();
  const country = localizeCountryName(record.country, record.countryCode, locale);

  if (city && country) {
    return `${city}, ${country}`;
  }

  if (city) {
    return city;
  }

  if (country) {
    return country;
  }

  if (record.region?.trim()) {
    return record.region.trim();
  }

  return null;
}
