import type { ViewStyle } from 'react-native';

import { componentSize } from '@/design/layout';
import { spacing } from '@/design/spacing';

export type EventCardVariant =
  | 'standard'
  | 'featured'
  | 'featuredHome'
  | 'compact'
  | 'compactPremium'
  | 'verticalPremium';

import type { EventImageVariant } from './EventImage';

export interface EventCardMetrics {
  imageVariant: EventImageVariant;
  containerStyle: ViewStyle;
  contentGap: number;
}

export function resolveEventCardMetrics(variant: EventCardVariant): EventCardMetrics {
  switch (variant) {
    case 'featured':
      return {
        imageVariant: 'featured',
        containerStyle: { minHeight: componentSize.eventListRowMinHeight },
        contentGap: spacing.md,
      };
    case 'featuredHome':
      return {
        imageVariant: 'featuredHome',
        containerStyle: {},
        contentGap: spacing.xs,
      };
    case 'compactPremium':
      return {
        imageVariant: 'compactPremium',
        containerStyle: {},
        contentGap: spacing.xs,
      };
    case 'verticalPremium':
      return {
        imageVariant: 'verticalPremium',
        containerStyle: {},
        contentGap: spacing.xs,
      };
    case 'compact':
      return {
        imageVariant: 'compact',
        containerStyle: { minHeight: componentSize.eventListRowMinHeight },
        contentGap: spacing.sm,
      };
    case 'standard':
    default:
      return {
        imageVariant: 'list',
        containerStyle: { minHeight: componentSize.eventListRowMinHeight },
        contentGap: spacing.md,
      };
  }
}
