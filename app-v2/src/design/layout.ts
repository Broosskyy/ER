/**
 * Eternal Rave layout constants.
 * Source: reference/old-code/src/constants/theme.ts (BOTTOM_NAV_HEIGHT, AppConfig)
 */
export const layout = {
  bottomNavHeight: 64,
  minTouchTarget: 44,
  maxContentWidth: 480,
  screenPadding: 16,
} as const;

export const appConfig = {
  name: 'Eternal Rave',
  tagline: 'Discover. Connect. Rave.',
  locationLabel: 'Near you',
  defaultCity: 'Berlin',
} as const;
