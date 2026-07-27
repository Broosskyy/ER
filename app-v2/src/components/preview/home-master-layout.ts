import { layout } from '@/design/layout';

export type HomeMasterBreakpoint = 'mobile' | 'tablet' | 'desktop';

export const HOME_MASTER_WIDTHS = {
  mobile: [360, 390, 430],
  tablet: [768],
  desktop: [1024, 1440],
} as const;

export function resolveHomeContentMaxWidth(breakpoint: HomeMasterBreakpoint): number | undefined {
  switch (breakpoint) {
    case 'mobile':
      return undefined;
    case 'tablet':
      return layout.maxContentWidthTablet;
    case 'desktop':
      return layout.maxContentWidthDesktop;
    default:
      return undefined;
  }
}

export function resolveHomeGridColumns(breakpoint: HomeMasterBreakpoint): number {
  if (breakpoint === 'desktop') return 3;
  if (breakpoint === 'tablet') return 2;
  return 1;
}

export function resolveHomeFeaturedWidth(containerWidth: number, breakpoint: HomeMasterBreakpoint): number {
  if (breakpoint === 'mobile') {
    return Math.min(containerWidth - 32, containerWidth * 0.82);
  }
  if (breakpoint === 'tablet') {
    return Math.min(520, containerWidth * 0.6);
  }
  return Math.min(640, containerWidth * 0.48);
}
