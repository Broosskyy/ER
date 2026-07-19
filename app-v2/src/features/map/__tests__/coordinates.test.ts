import { describe, expect, it } from 'vitest';

import { isRenderableCoordinate, sanitizeMapRegion } from '../utils/coordinates';

describe('map coordinate guards', () => {
  it('rejects invalid coordinates', () => {
    expect(isRenderableCoordinate(Number.NaN, 6.96)).toBe(false);
    expect(isRenderableCoordinate(50.93, undefined)).toBe(false);
    expect(isRenderableCoordinate(120, 6.96)).toBe(false);
    expect(isRenderableCoordinate(50.93, 200)).toBe(false);
  });

  it('accepts valid köln coordinates', () => {
    expect(isRenderableCoordinate(50.9375, 6.9603)).toBe(true);
  });

  it('sanitizes invalid map regions', () => {
    const region = sanitizeMapRegion({
      latitude: Number.NaN,
      longitude: Number.NaN,
      latitudeDelta: Number.NaN,
      longitudeDelta: Number.NaN,
    });

    expect(region.latitude).toBe(50.9375);
    expect(region.longitude).toBe(6.9603);
    expect(region.latitudeDelta).toBeGreaterThan(0);
    expect(region.longitudeDelta).toBeGreaterThan(0);
  });
});
