import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const homeScreenSource = readFileSync(join(process.cwd(), 'app/(tabs)/index.tsx'), 'utf8');
const locationSelectorSource = readFileSync(
  join(process.cwd(), 'src/features/home/components/LocationSelector.tsx'),
  'utf8',
);
const homeHeaderSource = readFileSync(
  join(process.cwd(), 'src/features/home/components/HomeHeader.tsx'),
  'utf8',
);
describe('home header polish', () => {
  it('centers branding and links the activity icon to the activity route', () => {
    expect(homeHeaderSource).toContain('justifyContent: \'center\'');
    expect(homeHeaderSource).toContain('position: \'absolute\'');
    expect(homeHeaderSource).toContain('notifications-outline');
    expect(homeHeaderSource).toContain('home-activity-button');
    expect(homeHeaderSource).toContain("router.push('/activity')");
    expect(homeHeaderSource).not.toContain('NotificationButton');
    expect(homeHeaderSource).not.toContain('HomeHeaderSearchButton');
  });
});

describe('home screen composition (Sprint 2B.2)', () => {
  it('does not render a permanent home SearchBar or filter chip row', () => {
    expect(homeScreenSource).not.toContain('HomeSearchEntry');
    expect(homeScreenSource).not.toContain('FilterChipRow');
    expect(homeScreenSource).not.toContain('<SearchBar');
  });

  it('keeps premium hero cards without Home search controls', () => {
    expect(homeHeaderSource).not.toContain('search-outline');
    expect(homeHeaderSource).not.toContain('CreateHeaderButton');
    expect(homeHeaderSource).toContain('EternalRaveLogo');
    expect(homeScreenSource).toContain('HomeFeedContent');
    expect(homeScreenSource).not.toContain('HomeSearchEntry');
    expect(homeScreenSource).not.toContain('FilterChipRow');
    expect(homeScreenSource).not.toContain('<SearchBar');
  });

  it('delegates feed rendering to discovery-backed HomeFeedContent', () => {
    expect(homeScreenSource).toContain('HomeFeedContent');
    expect(homeScreenSource).not.toContain('getCollectionPreviewEvents');
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

  it('opens a location picker without a permanent Home filter control', () => {
    expect(locationSelectorSource).toContain('LocationPickerModal');
    expect(locationSelectorSource).toContain('requestCurrentLocation');
    expect(locationSelectorSource).toContain('CitySelector');
    expect(locationSelectorSource).not.toContain('home-location-filter-button');
    expect(locationSelectorSource).not.toContain('options-outline');
  });
});
