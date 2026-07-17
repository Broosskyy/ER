import { Dimensions } from 'react-native';

import { layout } from '@/design/layout';
import { spacingRoles } from '@/design/spacing';

export function getFeaturedCardWidth(): number {
  const screenWidth = Dimensions.get('window').width;
  return screenWidth - spacingRoles.screenHorizontal - layout.featuredCardPeek;
}
