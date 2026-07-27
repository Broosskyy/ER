import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const searchScreenSource = readFileSync(join(process.cwd(), 'app/(tabs)/search.tsx'), 'utf8');
const mapScreenSource = readFileSync(join(process.cwd(), 'app/(tabs)/map.tsx'), 'utf8');
const mapDiscoverySource = readFileSync(
  join(process.cwd(), 'src/features/map/components/MapDiscoveryScreen.tsx'),
  'utf8',
);

describe('map discovery screen wiring', () => {
  it('renders map discovery on the hidden map route', () => {
    expect(mapScreenSource).toContain('MapDiscoveryScreen');
    expect(mapScreenSource).not.toContain('MapUnavailableState');
  });

  it('supports grid to map switching on the events tab', () => {
    expect(searchScreenSource).toContain('DiscoveryGridMapToggle');
    expect(searchScreenSource).toContain('discoveryView');
    expect(searchScreenSource).toContain('MapDiscoveryScreen');
    expect(searchScreenSource).toContain('EventDiscoveryGrid');
  });

  it('exposes preview, filter sheet, and search-in-area affordances', () => {
    expect(mapDiscoverySource).toContain('MapEventPreviewBottomSheet');
    expect(mapDiscoverySource).toContain('MapFilterSheet');
    expect(mapDiscoverySource).toContain('In diesem Bereich suchen');
    expect(mapDiscoverySource).toContain('MapClubPreviewBottomSheet');
  });

  it('defines map discovery selectors for published events and clubs', () => {
    const selectorsSource = readFileSync(
      join(process.cwd(), 'src/features/map/utils/map-discovery-selectors.ts'),
      'utf8',
    );

    expect(selectorsSource).toContain('buildMapEvents');
    expect(selectorsSource).toContain('buildMapClubs');
    expect(selectorsSource).toContain('MAP_CLUB_FIXTURES');
  });
});
