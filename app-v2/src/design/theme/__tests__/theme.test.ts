import { describe, expect, it } from 'vitest';

import { darkTheme } from '@/design/theme/dark';
import { lightTheme } from '@/design/theme/light';
import {
  assertThemeContract,
  createNavigationTheme,
  getAndroidNavigationBarStyle,
  getExpoStatusBarStyle,
  getThemeByResolvedMode,
  resolveThemeMode,
} from '@/design/theme/theme-utils';
import { resolveTextRoleStyle } from '@/design/theme/text-role-styles';
import { missingProviderMessage } from '@/design/theme/theme-constants';
import { THEME_COLOR_KEYS, TEXT_ROLE_KEYS } from '@/design/theme/types';

describe('theme contract', () => {
  it('light theme fulfills the full theme contract', () => {
    expect(() => assertThemeContract(lightTheme)).not.toThrow();
    for (const key of THEME_COLOR_KEYS) {
      expect(lightTheme.colors[key]).toBeTruthy();
    }
    for (const role of TEXT_ROLE_KEYS) {
      expect(lightTheme.typography.roles[role]).toBeDefined();
      expect(lightTheme.typography.roles[role]?.color).toBeTruthy();
    }
  });

  it('dark theme fulfills the same contract', () => {
    expect(() => assertThemeContract(darkTheme)).not.toThrow();
    for (const key of THEME_COLOR_KEYS) {
      expect(darkTheme.colors[key]).toBeTruthy();
    }
    for (const role of TEXT_ROLE_KEYS) {
      expect(darkTheme.typography.roles[role]).toBeDefined();
      expect(darkTheme.typography.roles[role]?.color).toBeTruthy();
    }
  });

  it('light and dark themes expose identical color and role keys', () => {
    expect(Object.keys(lightTheme.colors).sort()).toEqual(Object.keys(darkTheme.colors).sort());
    expect(Object.keys(lightTheme.typography.roles).sort()).toEqual(
      Object.keys(darkTheme.typography.roles).sort(),
    );
  });
});

describe('resolveThemeMode', () => {
  it('resolves light mode directly', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light');
  });

  it('resolves dark mode directly', () => {
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });

  it('follows the system preference when mode is system', () => {
    expect(resolveThemeMode('system', 'light')).toBe('light');
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
  });

  it('defaults system mode to dark when preference is unavailable', () => {
    expect(resolveThemeMode('system', null)).toBe('dark');
    expect(resolveThemeMode('system', undefined)).toBe('dark');
  });
});

describe('getThemeByResolvedMode', () => {
  it('returns the matching theme object', () => {
    expect(getThemeByResolvedMode('light', { light: lightTheme, dark: darkTheme })).toBe(
      lightTheme,
    );
    expect(getThemeByResolvedMode('dark', { light: lightTheme, dark: darkTheme })).toBe(darkTheme);
  });
});

describe('navigation and status bar integration', () => {
  it('creates navigation themes with correct light and dark colors', () => {
    const lightNavigation = createNavigationTheme(lightTheme);
    const darkNavigation = createNavigationTheme(darkTheme);

    expect(lightNavigation.dark).toBe(false);
    expect(lightNavigation.colors.background).toBe(lightTheme.colors.background);
    expect(lightNavigation.colors.primary).toBe(lightTheme.colors.accent);

    expect(darkNavigation.dark).toBe(true);
    expect(darkNavigation.colors.background).toBe(darkTheme.colors.background);
    expect(darkNavigation.colors.primary).toBe(darkTheme.colors.accent);
  });

  it('resolves status bar styles from theme mode', () => {
    expect(getExpoStatusBarStyle(lightTheme)).toBe('dark');
    expect(getExpoStatusBarStyle(darkTheme)).toBe('light');
    expect(getAndroidNavigationBarStyle(lightTheme)).toBe('light');
    expect(getAndroidNavigationBarStyle(darkTheme)).toBe('dark');
  });
});

describe('AppText role resolution', () => {
  it('resolves every text role for light and dark themes', () => {
    for (const role of TEXT_ROLE_KEYS) {
      const lightStyle = resolveTextRoleStyle(lightTheme, role);
      const darkStyle = resolveTextRoleStyle(darkTheme, role);

      expect(lightStyle.fontSize).toBeGreaterThan(0);
      expect(lightStyle.color).toBeTruthy();
      expect(darkStyle.fontSize).toBeGreaterThan(0);
      expect(darkStyle.color).toBeTruthy();
    }
  });

  it('maps legacy aliases to canonical roles', () => {
    expect(resolveTextRoleStyle(darkTheme, 'screenTitle')).toEqual(
      resolveTextRoleStyle(darkTheme, 'titleLarge'),
    );
    expect(resolveTextRoleStyle(darkTheme, 'sectionTitle')).toEqual(
      resolveTextRoleStyle(darkTheme, 'titleMedium'),
    );
    expect(resolveTextRoleStyle(darkTheme, 'metadata')).toEqual(
      resolveTextRoleStyle(darkTheme, 'bodyMuted'),
    );
  });
});

describe('ThemeProvider contract', () => {
  it('documents a clear error when useTheme is used outside the provider', () => {
    expect(missingProviderMessage).toContain('useTheme must be used within ThemeProvider');
  });
});

describe('light theme design direction', () => {
  it('uses a warm light background and restrained accent', () => {
    expect(lightTheme.colors.background).toBe('#FAFAF8');
    expect(lightTheme.colors.accent).toBe('#6D5DF6');
    expect(lightTheme.colors.textPrimary).toBe('#111111');
  });
});

describe('dark theme evolution', () => {
  it('uses softened dark surfaces from Evolution V2', () => {
    expect(darkTheme.colors.background).toBe('#111214');
    expect(darkTheme.colors.surface).toBe('#1A1C1F');
    expect(darkTheme.colors.accent).toBe('#7C3AED');
  });
});
