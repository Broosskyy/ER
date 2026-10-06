import { layout } from '@/design/layout';

export const breakpoints = {
  tablet: 768,
  desktop: 1024,
} as const;

export type ResponsiveBreakpoint = 'mobile' | 'tablet' | 'desktop';

export function getBreakpoint(width: number): ResponsiveBreakpoint {
  if (width >= breakpoints.desktop) {
    return 'desktop';
  }

  if (width >= breakpoints.tablet) {
    return 'tablet';
  }

  return 'mobile';
}

export function getContentMaxWidth(width: number): number | undefined {
  const breakpoint = getBreakpoint(width);

  if (breakpoint === 'desktop') {
    return layout.maxContentWidthDesktop;
  }

  if (breakpoint === 'tablet') {
    return layout.maxContentWidthTablet;
  }

  return undefined;
}

export function getExploreGridColumns(width: number): number {
  const breakpoint = getBreakpoint(width);

  if (breakpoint === 'desktop') {
    return 4;
  }

  if (breakpoint === 'tablet') {
    return 3;
  }

  return 3;
}

export function shouldShowWebTopNav(width: number, platformOs: string): boolean {
  return platformOs === 'web' && width >= breakpoints.desktop;
}
