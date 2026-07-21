import { describe, expect, it } from 'vitest';

import { resolveDiscoveryCityLabel } from '@/features/location/resolve-discovery-city';
import type { UserLocationRecord } from '@/features/location/types/user-location';

describe('discovery city resolution', () => {
  it('prefers manual discovery city label', () => {
    const record: UserLocationRecord = {
      latitude: 52.52,
      longitude: 13.405,
      city: 'Berlin',
      country: 'Germany',
      updatedAt: '2026-07-21T10:00:00.000Z',
      source: 'manual',
      discoveryCityId: 'berlin',
    };

    expect(resolveDiscoveryCityLabel(record)).toBe('Berlin');
    expect(record.discoveryCityId).toBe('berlin');
  });
});
