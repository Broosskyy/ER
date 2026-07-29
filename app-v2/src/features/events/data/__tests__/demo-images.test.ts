import { describe, expect, it, vi } from 'vitest';

const fallbackAsset = { uri: 'fallback-demo-asset' };

vi.mock('../demo-image-assets', () => ({
  getEventImageAsset: vi.fn(() => fallbackAsset),
}));

import { getEventImageAsset } from '../demo-image-assets';
import { resolveEventImageSource } from '../event-image-resolver';

describe('resolveEventImageSource', () => {
  it('prefers remote imageUrl over demo asset fallback', () => {
    const source = resolveEventImageSource({
      id: 'evt-bootshaus-001',
      imageUrl: 'https://bootshaus.de/flyer.jpg',
    });

    expect(source).toEqual({ uri: 'https://bootshaus.de/flyer.jpg' });
    expect(getEventImageAsset).not.toHaveBeenCalled();
  });

  it('falls back to demo asset when imageUrl is missing', () => {
    const source = resolveEventImageSource({
      id: 'void-techno-saturday',
    });

    expect(source).toBe(fallbackAsset);
    expect(getEventImageAsset).toHaveBeenCalledWith('void-techno-saturday', undefined);
  });

  it('falls back to demo asset when imageUrl is blank', () => {
    const source = resolveEventImageSource({
      id: 'void-techno-saturday',
      imageUrl: '   ',
    });

    expect(source).toBe(fallbackAsset);
    expect(getEventImageAsset).toHaveBeenCalledWith('void-techno-saturday', undefined);
  });
});
