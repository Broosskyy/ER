import { Dimensions } from 'react-native';

import { layout } from '@/design/layout';
import { spacingRoles } from '@/design/spacing';
import { getContentMaxWidth } from '@/platform/responsive';

export function getFeaturedCardWidth(viewportWidth?: number): number {
  const screenWidth = viewportWidth ?? Dimensions.get('window').width;
  const contentMaxWidth = getContentMaxWidth(screenWidth) ?? screenWidth;
  const effectiveWidth = Math.min(screenWidth, contentMaxWidth);

  return effectiveWidth - spacingRoles.screenHorizontal - layout.featuredCardPeek;
}
