import { Platform, useWindowDimensions } from 'react-native';

import {
  getBreakpoint,
  getContentMaxWidth,
  getExploreGridColumns,
  shouldShowWebTopNav as shouldShowWebTopNavForPlatform,
  type ResponsiveBreakpoint,
} from '@/platform/responsive-layout';

export {
  breakpoints,
  getBreakpoint,
  getContentMaxWidth,
  getExploreGridColumns,
  type ResponsiveBreakpoint,
} from '@/platform/responsive-layout';

export interface ResponsiveLayout {
  width: number;
  breakpoint: ResponsiveBreakpoint;
  contentMaxWidth: number | undefined;
  showWebTopNav: boolean;
  exploreGridColumns: number;
  isTabletOrLarger: boolean;
}

export function shouldShowWebTopNav(width: number): boolean {
  return shouldShowWebTopNavForPlatform(width, Platform.OS);
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();
  const breakpoint = getBreakpoint(width);

  return {
    width,
    breakpoint,
    contentMaxWidth: getContentMaxWidth(width),
    showWebTopNav: shouldShowWebTopNav(width),
    exploreGridColumns: getExploreGridColumns(width),
    isTabletOrLarger: breakpoint !== 'mobile',
  };
}
