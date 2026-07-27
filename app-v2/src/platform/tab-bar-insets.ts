import type { EdgeInsets } from 'react-native-safe-area-context';

import { layout } from '@/design/layout';
import { spacing } from '@/design/spacing';

export function getBottomTabBarPadding(insets: EdgeInsets): number {
  return Math.max(insets.bottom, spacing.md);
}

export function getBottomTabBarHeight(insets: EdgeInsets): number {
  return layout.bottomNavHeight + getBottomTabBarPadding(insets);
}
