import type {
  ResolvedThemeMode,
  ResolvedNavigationTheme,
  Theme,
  ThemeModePreference,
} from './types';

export function resolveThemeMode(
  mode: ThemeModePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): ResolvedThemeMode {
  if (mode === 'system') {
    return systemScheme === 'light' ? 'light' : 'dark';
  }

  return mode;
}

export function getThemeForMode(
  mode: ResolvedThemeMode,
  themes: { light: Theme; dark: Theme },
): Theme {
  return mode === 'light' ? themes.light : themes.dark;
}

export function resolveNavigationTheme(theme: Theme): ResolvedNavigationTheme {
  return {
    dark: theme.mode === 'dark',
    colors: {
      background: theme.colors.background,
      card: theme.colors.surface,
      border: theme.colors.borderSubtle,
      primary: theme.colors.accent,
      text: theme.colors.textPrimary,
      notification: theme.colors.destructive,
    },
  };
}

export function resolveStatusBarStyle(
  theme: Theme,
): 'light' | 'dark' | 'auto' {
  return theme.statusBarStyle;
}

export function resolveNavigationBarStyle(
  theme: Theme,
): 'light' | 'dark' {
  return theme.navigationBarStyle;
}
