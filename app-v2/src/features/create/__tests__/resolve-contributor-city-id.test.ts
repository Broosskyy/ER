import { describe, expect, it } from 'vitest';

import { resolveContributorCityId } from '@/features/create/utils/resolve-contributor-city-id';

describe('resolveContributorCityId', () => {
  it('falls back to first active city when existing id is unknown', async () => {
    const resolved = await resolveContributorCityId('staging-seed-city-koeln');
    expect(resolved).toBe('koeln');
  });

  it('keeps valid city ids', async () => {
    const resolved = await resolveContributorCityId('koeln');
    expect(resolved).toBe('koeln');
  });
});
