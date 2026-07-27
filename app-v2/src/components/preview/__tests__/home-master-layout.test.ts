import { describe, expect, it } from 'vitest';

import { layout } from '@/design/layout';

import {
  HOME_MASTER_WIDTHS,
  resolveHomeContentMaxWidth,
  resolveHomeFeaturedWidth,
  resolveHomeGridColumns,
} from '@/components/preview/home-master-layout';

describe('home-master-layout', () => {
  it('exposes QA reference widths for mobile, tablet, and desktop', () => {
    expect(HOME_MASTER_WIDTHS.mobile).toEqual([360, 390, 430]);
    expect(HOME_MASTER_WIDTHS.tablet).toEqual([768]);
    expect(HOME_MASTER_WIDTHS.desktop).toEqual([1024, 1440]);
  });

  it('resolves content max width from layout tokens', () => {
    expect(resolveHomeContentMaxWidth('mobile')).toBeUndefined();
    expect(resolveHomeContentMaxWidth('tablet')).toBe(layout.maxContentWidthTablet);
    expect(resolveHomeContentMaxWidth('desktop')).toBe(layout.maxContentWidthDesktop);
  });

  it('resolves grid columns by breakpoint', () => {
    expect(resolveHomeGridColumns('mobile')).toBe(1);
    expect(resolveHomeGridColumns('tablet')).toBe(2);
    expect(resolveHomeGridColumns('desktop')).toBe(3);
  });

  it('keeps featured width within mobile frame padding', () => {
    const width = resolveHomeFeaturedWidth(390, 'mobile');
    expect(width).toBeLessThanOrEqual(358);
    expect(width).toBeGreaterThan(300);
  });

  it('allocates a wider featured region on desktop', () => {
    const mobile = resolveHomeFeaturedWidth(390, 'mobile');
    const desktop = resolveHomeFeaturedWidth(1280, 'desktop');
    expect(desktop).toBeGreaterThan(mobile);
    expect(desktop).toBeLessThanOrEqual(640);
  });
});
