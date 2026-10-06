import { describe, expect, it } from 'vitest';

import {
  breakpoints,
  getBreakpoint,
  getContentMaxWidth,
  getExploreGridColumns,
  shouldShowWebTopNav,
} from '../responsive-layout';

describe('responsive layout', () => {
  it('classifies breakpoints', () => {
    expect(getBreakpoint(360)).toBe('mobile');
    expect(getBreakpoint(768)).toBe('tablet');
    expect(getBreakpoint(1280)).toBe('desktop');
  });

  it('returns content max widths for tablet and desktop', () => {
    expect(getContentMaxWidth(360)).toBeUndefined();
    expect(getContentMaxWidth(800)).toBe(720);
    expect(getContentMaxWidth(1200)).toBe(960);
  });

  it('returns explore grid columns by breakpoint', () => {
    expect(getExploreGridColumns(360)).toBe(3);
    expect(getExploreGridColumns(800)).toBe(3);
    expect(getExploreGridColumns(1200)).toBe(4);
  });

  it('only enables web top navigation on desktop web', () => {
    expect(shouldShowWebTopNav(breakpoints.desktop, 'web')).toBe(true);
    expect(shouldShowWebTopNav(breakpoints.desktop, 'android')).toBe(false);
    expect(shouldShowWebTopNav(360, 'web')).toBe(false);
  });
});
