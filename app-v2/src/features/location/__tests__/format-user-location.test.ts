import { describe, expect, it } from 'vitest';

import { formatUserLocationLabel, localizeCountryName } from '@/features/location/format-user-location';

describe('formatUserLocationLabel', () => {
  it('formats city and localized country', () => {
    const label = formatUserLocationLabel(
      {
        city: 'Köln',
        country: 'Germany',
        countryCode: 'DE',
      },
      'de',
    );

    expect(label).toBe('Köln, Deutschland');
  });

  it('falls back to region when city is missing', () => {
    const label = formatUserLocationLabel(
      {
        region: 'North Rhine-Westphalia',
        countryCode: 'DE',
      },
      'en',
    );

    expect(label).toBe('North Rhine-Westphalia, Germany');
  });

  it('returns null when no displayable place is available', () => {
    expect(formatUserLocationLabel(null, 'en')).toBeNull();
    expect(formatUserLocationLabel({ latitude: 0, longitude: 0, updatedAt: '' }, 'en')).toBeNull();
  });
});

describe('localizeCountryName', () => {
  it('localizes country codes for the active locale', () => {
    expect(localizeCountryName('Germany', 'DE', 'de')).toBe('Deutschland');
    expect(localizeCountryName('Germany', 'DE', 'en')).toBe('Germany');
  });
});
