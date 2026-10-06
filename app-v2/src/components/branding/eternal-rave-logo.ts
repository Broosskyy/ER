import type { ImageSourcePropType } from 'react-native';

/**
 * Central Eternal Rave logo configuration.
 * Replace `imageSource` with the final SVG/PNG require() to update the logo app-wide.
 *
 * Example:
 * imageSource: require('../../../assets/images/eternal-rave-logo.png'),
 */
export const ETERNAL_RAVE_LOGO_CONFIG = {
  imageSource: null as ImageSourcePropType | null,
  showWordmarkWithImage: true,
  wordmark: 'ETERNAL RΛVE',
} as const;
