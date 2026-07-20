import { describe, expect, it } from 'vitest';

import { resolveLocationDisplayLabel } from '@/features/location/resolve-location-display';

describe('resolveLocationDisplayLabel', () => {
  const labels = {
    choose: 'Choose location',
    loading: 'Getting location…',
  };

  it('shows the initial choose label without a stored location', () => {
    expect(resolveLocationDisplayLabel('initial', null, 'en', labels)).toBe('Choose location');
  });

  it('shows loading text while resolving', () => {
    expect(resolveLocationDisplayLabel('loading', null, 'en', labels)).toBe('Getting location…');
  });

  it('shows a formatted city-country label after success', () => {
    expect(
      resolveLocationDisplayLabel(
        'ready',
        {
          latitude: 50.9375,
          longitude: 6.9603,
          city: 'Köln',
          countryCode: 'DE',
          updatedAt: '2026-07-20T10:00:00.000Z',
        },
        'de',
        labels,
      ),
    ).toBe('Köln, Deutschland');
  });
});
