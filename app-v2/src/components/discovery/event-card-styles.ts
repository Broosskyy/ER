import type { ViewStyle } from 'react-native';

import { componentSize } from '@/design/layout';
import { spacing } from '@/design/spacing';

export type EventCardVariant = 'standard' | 'featured' | 'compact';

export interface EventCardMetrics {
  imageVariant: 'list' | 'featured' | 'compact';
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
