import { Dimensions } from 'react-native';

import { spacing, spacingRoles } from '@/design/spacing';
import { getContentMaxWidth } from '@/platform/responsive';

/** Gap between adjacent home featured hero cards. */
export const HOME_FEATURED_PAIR_GAP = spacing.md;

/**
 * Featured hero rail is designed for exactly three regional placement slots.
 * Backend will fill these dynamically per location + radius later.
 */
export const HOME_FEATURED_SLOT_COUNT = 3;

/**
 * Width ratio for one featured card — leaves a peek of the next slot for scroll affordance.
 * ~78% reads as a premium hero, not a standard two-up carousel.
 */
export const HOME_FEATURED_CARD_WIDTH_RATIO = 0.78;

/**
 * Width for one featured hero card in the home rail.
 * Formula: (viewport − 2×screen padding) × width ratio
 */
export function getHomeFeaturedCardWidth(viewportWidth?: number): number {
  const screenWidth = viewportWidth ?? Dimensions.get('window').width;
  const contentMaxWidth = getContentMaxWidth(screenWidth) ?? screenWidth;
  const effectiveWidth = Math.min(screenWidth, contentMaxWidth);
  const available = effectiveWidth - spacingRoles.screenHorizontal * 2;

  return Math.floor(available * HOME_FEATURED_CARD_WIDTH_RATIO);
}

/** @deprecated Use getHomeFeaturedCardWidth for the premium hero rail. */
export function getHomeFeaturedPairCardWidth(viewportWidth?: number): number {
  return getHomeFeaturedCardWidth(viewportWidth);
}

/** @deprecated Use getHomeFeaturedCardWidth. */
export function getFeaturedCardWidth(viewportWidth?: number): number {
  return getHomeFeaturedCardWidth(viewportWidth);
}
