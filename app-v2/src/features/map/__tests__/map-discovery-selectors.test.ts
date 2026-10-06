import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const selectorsSource = readFileSync(
  join(process.cwd(), 'src/features/map/utils/map-discovery-selectors.ts'),
  'utf8',
);

describe('map discovery selector contracts', () => {
  it('defines event and club builders with radius and status helpers', () => {
    expect(selectorsSource).toContain('buildMapEvents');
    expect(selectorsSource).toContain('buildMapClubs');
    expect(selectorsSource).toContain('resolveMarkerStatus');
    expect(selectorsSource).toContain('calculateDistanceKm');
    expect(selectorsSource).toContain('projectMarkerToCanvas');
  });

  it('keeps clustering and lazy-loading as prepared architecture only', () => {
    const modelsSource = readFileSync(
      join(process.cwd(), 'src/features/map/types/discovery-models.ts'),
      'utf8',
    );

    expect(modelsSource).toContain('MAP_CLUSTERING_CONFIG');
    expect(modelsSource).toContain('MAP_LAZY_LOADING_CONFIG');
    expect(modelsSource).toContain('MAP_VIEWPORT_RENDERING_CONFIG');
  });
});
