import { Dimensions } from 'react-native';

import type { VenueListItemViewModel } from '@/components/discovery/view-models';
import { spacingRoles } from '@/design/spacing';
import { getEventImageAsset } from '@/features/events/data/demo-images';
import { getContentMaxWidth } from '@/platform/responsive';

const HOME_CLUB_MAX_WIDTH = 160;



/** Preview club data for the home Top Clubs rail until venue discovery is wired. */

export const HOME_CLUB_FIXTURES: VenueListItemViewModel[] = [

  {

    id: 'berghain',

    name: 'Berghain',

    cityLabel: 'Berlin',

    image: getEventImageAsset('club-berghain'),

    accessibilityLabel: 'Berghain, Berlin',

  },

  {

    id: 'sisyphos',

    name: 'Sisyphos',

    cityLabel: 'Berlin',

    image: getEventImageAsset('club-sisyphos'),

    accessibilityLabel: 'Sisyphos, Berlin',

  },

  {

    id: 'bootshaus',

    name: 'Bootshaus',

    cityLabel: 'Köln',

    image: getEventImageAsset('club-bootshaus'),

    accessibilityLabel: 'Bootshaus, Köln',

  },

  {

    id: 'about-blank',

    name: '://about blank',

    cityLabel: 'Berlin',

    image: getEventImageAsset('club-about-blank'),

    accessibilityLabel: '://about blank, Berlin',

  },

  {

    id: 'watergate',

    name: 'Watergate',

    cityLabel: 'Berlin',

    image: getEventImageAsset('club-watergate'),

    accessibilityLabel: 'Watergate, Berlin',

  },

];



/**
 * Compact Top-Clubs rail: approximately 2.5 cards are visible on a 390px viewport.
 * It intentionally stays independent from the featured hero width and is capped on desktop.
 */
export function getHomeClubSpotlightWidth(viewportWidth?: number): number {
  const screenWidth = viewportWidth ?? Dimensions.get('window').width;
  const contentMaxWidth = getContentMaxWidth(screenWidth) ?? screenWidth;
  const effectiveWidth = Math.min(screenWidth, contentMaxWidth);
  const availableWidth = effectiveWidth - spacingRoles.screenHorizontal * 2;

  return Math.min(HOME_CLUB_MAX_WIDTH, Math.floor(availableWidth * 0.4));
}

