import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacingRoles } from '@/design/spacing';
import { useResponsiveLayout } from '@/platform/responsive';
import { getBottomTabBarHeight } from '@/platform/tab-bar-insets';

export function useScreenBottomInset(): number {
  const insets = useSafeAreaInsets();
  const { showWebTopNav } = useResponsiveLayout();

  if (showWebTopNav) {
    return Math.max(insets.bottom, spacingRoles.listBottomInset);
  }

  return getBottomTabBarHeight(insets) + spacingRoles.listBottomInset;
}
