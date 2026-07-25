import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { ThemeProvider as NavigationThemeProvider } from 'expo-router';

import { darkTheme } from './dark';
import { lightTheme } from './light';
import { createNavigationTheme, getThemeByResolvedMode, resolveThemeMode } from './theme-utils';
import { missingProviderMessage } from './theme-constants';
import type { EternalRaveTheme, ResolvedThemeMode, ThemeMode } from './types';

export interface ThemeContextValue {
  theme: EternalRaveTheme;
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const defaultThemes = {
  light: lightTheme,
  dark: darkTheme,
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

export function ThemeProvider({ children, defaultMode = 'dark' }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);

  const resolvedMode = useMemo(
    () => resolveThemeMode(mode, systemColorScheme === 'light' ? 'light' : 'dark'),
    [mode, systemColorScheme],
  );

  const theme = useMemo(
    () => getThemeByResolvedMode(resolvedMode, defaultThemes),
    [resolvedMode],
  );

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      resolvedMode,
      setMode,
    }),
    [mode, resolvedMode, setMode, theme],
  );

  const navigationTheme = useMemo(() => createNavigationTheme(theme), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(missingProviderMessage);
  }

  return context;
}

export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
