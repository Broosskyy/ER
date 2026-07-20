import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { shouldShowNotificationButton } from '@/features/home/home-header-config';

const homeScreenSource = readFileSync(join(process.cwd(), 'app/(tabs)/index.tsx'), 'utf8');
const locationSelectorSource = readFileSync(
  join(process.cwd(), 'src/features/home/components/LocationSelector.tsx'),
  'utf8',
);
const homeHeaderSource = readFileSync(
  join(process.cwd(), 'src/features/home/components/HomeHeader.tsx'),
  'utf8',
);

describe('home header auth visibility', () => {
  it('shows the activity button only for authenticated users', () => {
    expect(shouldShowNotificationButton(false)).toBe(false);
    expect(shouldShowNotificationButton(true)).toBe(true);
  });

  it('renders the activity button conditionally in HomeHeader', () => {
    expect(homeHeaderSource).toContain('shouldShowNotificationButton');
    expect(homeHeaderSource).toContain('{showActivityButton ? <NotificationButton /> : null}');
  });
});

describe('home screen header actions', () => {
  it('removes the home filter button from the screen source', () => {
    expect(homeScreenSource).not.toContain('options-outline');
    expect(homeScreenSource).not.toContain('IconButton');
    expect(homeScreenSource).not.toContain('accessibilityLabel="Filters"');
  });

  it('keeps the location selector on the home screen', () => {
    expect(homeScreenSource).toContain('<LocationSelector />');
  });
});

describe('home location selector source', () => {
  it('does not hardcode Cologne or Germany in the selector', () => {
    expect(locationSelectorSource).not.toContain('Köln');
    expect(locationSelectorSource).not.toContain('Germany');
    expect(locationSelectorSource).not.toContain('defaultCity');
  });

  it('opens a location picker on press', () => {
    expect(locationSelectorSource).toContain('LocationPickerModal');
    expect(locationSelectorSource).toContain('requestCurrentLocation');
    expect(locationSelectorSource).toContain('accessibilityRole="button"');
  });
});
