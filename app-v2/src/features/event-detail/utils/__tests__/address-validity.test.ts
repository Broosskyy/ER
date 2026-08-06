import { describe, expect, it } from 'vitest';

import { resolveAddressValidity } from '@/features/event-detail/utils/address-validity';

describe('resolveAddressValidity', () => {
  it('does not treat venue names as street addresses', () => {
    const result = resolveAddressValidity({
      venueName: 'Bootshaus',
      address: 'Bootshaus',
      city: 'Köln',
    });

    expect(result.hasRealStreetAddress).toBe(false);
    expect(result.canOpenDirections).toBe(false);
  });

  it('allows directions for coordinates or real streets', () => {
    expect(
      resolveAddressValidity({
        venueName: 'Bootshaus',
        address: 'Hafenstraße 24',
        city: 'Köln',
      }).canOpenDirections,
    ).toBe(true);

    expect(
      resolveAddressValidity({
        venueName: 'Bootshaus',
        latitude: 50.94,
        longitude: 6.96,
      }).canOpenDirections,
    ).toBe(true);
  });
});
