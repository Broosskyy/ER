import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme } from './dark';
import { lightTheme } from './light';
import { getThemeForMode, resolveThemeMode } from './resolve';
import { loadThemeModePreference, saveThemeModePreference } from './theme-storage';
import { assertThemeContext } from './context';
import type { ThemeContextValue, ThemeModePreference } from './types';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Allows tests to override the initial preference without persistence. */
  initialMode?: ThemeModePreference;
}

export function ThemeProvider({
  children,
  initialMode = 'system',
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeModePreference>(initialMode);

  useEffect(() => {
    let active = true;

    void loadThemeModePreference().then((stored) => {
      if (active && stored) {
        setModeState(stored);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const resolvedMode = useMemo(
    () =>
      resolveThemeMode(
        mode,
        systemScheme === 'light' || systemScheme === 'dark' ? systemScheme : null,
      ),
    [mode, systemScheme],
  );

  const theme = useMemo(
    () => getThemeForMode(resolvedMode, { light: lightTheme, dark: darkTheme }),
    [resolvedMode],
  );

  const setMode = useCallback((nextMode: ThemeModePreference) => {
    setModeState(nextMode);
    void saveThemeModePreference(nextMode);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      resolvedMode,
      setMode,
    }),
    [theme, mode, resolvedMode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  assertThemeContext(context);
  return context;
}

export { ThemeContext };
