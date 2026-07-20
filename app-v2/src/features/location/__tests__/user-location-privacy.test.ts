import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const providerSource = readFileSync(
  join(process.cwd(), 'src/features/location/UserLocationProvider.tsx'),
  'utf8',
);

describe('user location privacy behavior', () => {
  it('hydrates stored location on startup without requesting device permission', () => {
    const hydrateEffect = providerSource.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/)?.[0] ?? '';

    expect(hydrateEffect).toContain('loadStoredUserLocation');
    expect(hydrateEffect).not.toContain('requestCurrentUserLocation');
  });

  it('requests device location only through the explicit user action callback', () => {
    expect(providerSource).toContain('const requestCurrentLocation = useCallback');
    expect(providerSource).toContain('requestCurrentUserLocation(locale)');
  });
});
