import { createEternalRaveTheme } from './create-theme';
import { lightThemeColors } from './palettes';
import type { ThemeShadows } from './types';

export { lightThemeColors } from './palettes';

export const lightThemeShadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#111214',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#111214',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
} as const satisfies ThemeShadows;

export const lightTheme = createEternalRaveTheme(
  'light',
  lightThemeColors,
  lightThemeShadows,
  'dark',
);
