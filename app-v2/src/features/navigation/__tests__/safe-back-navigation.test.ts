import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SAFE_BACK_FALLBACK,
  navigateBackSafely,
} from '@/features/navigation/safe-back-navigation';

describe('navigateBackSafely', () => {
  it('uses history when the navigator can go back', () => {
    const router = {
      canGoBack: () => true,
      back: vi.fn(),
      replace: vi.fn(),
    };

    navigateBackSafely(router);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces with the default fallback when history is empty', () => {
    const router = {
      canGoBack: () => false,
      back: vi.fn(),
      replace: vi.fn(),
    };

    navigateBackSafely(router);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(DEFAULT_SAFE_BACK_FALLBACK);
  });

  it('replaces with a contextual fallback for direct-route refreshes', () => {
    const router = {
      canGoBack: () => false,
      back: vi.fn(),
      replace: vi.fn(),
    };

    navigateBackSafely(router, '/(tabs)/search');

    expect(router.replace).toHaveBeenCalledWith('/(tabs)/search');
  });
});
