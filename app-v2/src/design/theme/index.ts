import { darkTheme } from './dark';
import { lightTheme } from './light';

export { ThemeProvider, useTheme, useThemeOptional } from './ThemeProvider';
export { missingProviderMessage } from './theme-constants';

export { lightTheme, lightThemeColors, lightThemeShadows } from './light';
export { darkTheme, darkThemeColors, darkThemeShadows } from './dark';
export { createEternalRaveTheme } from './create-theme';

export {
  assertThemeContract,
  createNavigationTheme,
  getAndroidNavigationBarStyle,
  getExpoStatusBarStyle,
  getThemeByResolvedMode,
  resolveThemeMode,
} from './theme-utils';

export type {
  EternalRaveTheme,
  LegacyColorRoles,
  NavigationTheme,
  ResolvedThemeMode,
  StatusBarStyle,
  TextRole,
  ThemeColors,
  ThemeMode,
  ThemeShadows,
  ThemeTextRoles,
  ThemeTypography,
} from './types';

export { THEME_COLOR_KEYS, TEXT_ROLE_KEYS } from './types';

export { resolveTextRoleStyle } from './text-role-styles';
export { ThemedSystemUi } from './ThemedSystemUi';

/**
 * Static theme snapshot for non-React contexts. Prefer `useTheme()` in components.
 */
export const theme = darkTheme;

export type Theme = typeof theme;

export { colors, colorRoles, opacity } from '../colors';
export { spacing, spacingRoles } from '../spacing';
export {
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
  textVariants,
  textRoles,
} from '../typography';
export { radii, radiusRoles, borderWidth } from '../radii';
export { shadows } from '../shadows';
export { layout, componentSize, v1Components, appConfig } from '../layout';
