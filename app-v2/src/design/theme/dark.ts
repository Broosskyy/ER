import { createEternalRaveTheme } from './create-theme';
import { darkThemeColors } from './palettes';
import type { ThemeShadows } from './types';

export { darkThemeColors } from './palettes';

export const darkThemeShadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
} as const satisfies ThemeShadows;

export const darkTheme = createEternalRaveTheme(
  'dark',
  darkThemeColors,
  darkThemeShadows,
  'light',
);
