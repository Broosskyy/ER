import type { ThemeContextValue } from './types';

export const THEME_PROVIDER_ERROR = 'useTheme must be used within a ThemeProvider';

export function assertThemeContext(
  context: ThemeContextValue | null,
): asserts context is ThemeContextValue {
  if (!context) {
    throw new Error(THEME_PROVIDER_ERROR);
  }
}
