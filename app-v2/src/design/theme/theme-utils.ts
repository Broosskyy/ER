import type { NavigationTheme } from './types';
import type { EternalRaveTheme, ResolvedThemeMode, ThemeMode } from './types';

const navigationFonts = {
  regular: { fontFamily: 'System', fontWeight: '400' as const },
  medium: { fontFamily: 'System', fontWeight: '500' as const },
  bold: { fontFamily: 'System', fontWeight: '700' as const },
  heavy: { fontFamily: 'System', fontWeight: '800' as const },
};

export function resolveThemeMode(
  mode: ThemeMode,
  systemColorScheme: ResolvedThemeMode | null | undefined,
): ResolvedThemeMode {
  if (mode === 'system') {
    return systemColorScheme === 'light' ? 'light' : 'dark';
  }

  return mode;
}

export function getThemeByResolvedMode(
  resolvedMode: ResolvedThemeMode,
  themes: { light: EternalRaveTheme; dark: EternalRaveTheme },
): EternalRaveTheme {
  return resolvedMode === 'light' ? themes.light : themes.dark;
}

export function createNavigationTheme(theme: EternalRaveTheme): NavigationTheme {
  const isDark = theme.mode === 'dark';

  return {
    dark: isDark,
    colors: {
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.borderSubtle,
      notification: theme.colors.destructive,
    },
    fonts: navigationFonts,
  };
}

export function getExpoStatusBarStyle(
  theme: EternalRaveTheme,
): 'light' | 'dark' | 'auto' {
  return theme.statusBarStyle;
}

export function getAndroidNavigationBarStyle(
  theme: EternalRaveTheme,
): 'light' | 'dark' {
  return theme.statusBarStyle === 'light' ? 'dark' : 'light';
}

export function assertThemeContract(theme: EternalRaveTheme): void {
  for (const key of Object.keys(theme.colors)) {
    const value = theme.colors[key as keyof typeof theme.colors];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Theme color "${key}" is undefined`);
    }
  }

  for (const key of Object.keys(theme.typography.roles)) {
    const role = theme.typography.roles[key as keyof typeof theme.typography.roles];
    if (!role || role.fontSize === undefined || role.color === undefined) {
      throw new Error(`Typography role "${key}" is incomplete`);
    }
  }
}
