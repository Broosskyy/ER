import { describe, expect, it } from 'vitest';

import {
  APP_TEXT_ROLES,
  THEME_COLOR_KEYS,
  createTextRoles,
} from '@/design/theme/createTheme';
import { darkTheme } from '@/design/theme/dark';
import { lightTheme } from '@/design/theme/light';
import { assertThemeContext } from '@/design/theme/context';
import {
  getThemeForMode,
  resolveNavigationBarStyle,
  resolveNavigationTheme,
  resolveStatusBarStyle,
  resolveThemeMode,
} from '@/design/theme/resolve';
import type { AppTextRole, Theme, ThemeColorRoles, ThemeColors } from '@/design/theme/types';

const COLOR_ROLE_KEYS: (keyof ThemeColorRoles)[] = [
  'appBackground',
  'screenBackground',
  'headerBackground',
  'headerTitle',
  'headerIcon',
  'bottomNavBackground',
  'bottomNavBorder',
  'bottomNavActive',
  'bottomNavInactive',
  'searchBackground',
  'searchBorder',
  'searchPlaceholder',
  'searchText',
  'chipBackground',
  'chipBorder',
  'chipText',
  'chipSelectedBackground',
  'chipSelectedBorder',
  'chipSelectedText',
  'cardBackground',
  'cardBorder',
  'buttonPrimaryBackground',
  'buttonPrimaryText',
  'buttonPrimaryPressed',
  'buttonSecondaryBackground',
  'buttonSecondaryBorder',
  'buttonSecondaryText',
  'badgeBackground',
  'badgeText',
  'tagBackground',
  'tagText',
  'favoriteActive',
  'favoriteInactive',
  'mapCluster',
  'mapUserLocation',
  'overlayScrim',
  'imageOverlayGradientStart',
  'imageOverlayGradientEnd',
  'emptyStateIcon',
  'emptyStateTitle',
  'emptyStateDescription',
  'skeletonBase',
  'skeletonHighlight',
];

function assertThemeContract(theme: Theme) {
  expect(theme.mode).toMatch(/^(light|dark)$/);

  for (const key of THEME_COLOR_KEYS) {
    const value = theme.colors[key as keyof ThemeColors];
    expect(value, `colors.${key}`).toBeDefined();
    expect(typeof value, `colors.${key}`).toBe('string');
    expect(value.length, `colors.${key}`).toBeGreaterThan(0);
  }

  for (const key of COLOR_ROLE_KEYS) {
    const value = theme.colorRoles[key];
    expect(value, `colorRoles.${key}`).toBeDefined();
    expect(typeof value, `colorRoles.${key}`).toBe('string');
    expect(value.length, `colorRoles.${key}`).toBeGreaterThan(0);
  }

  for (const role of APP_TEXT_ROLES as readonly AppTextRole[]) {
    const style = theme.typography.textRoles[role];
    expect(style, `textRoles.${role}`).toBeDefined();
    expect(style.fontSize, `textRoles.${role}.fontSize`).toBeDefined();
    expect(style.color, `textRoles.${role}.color`).toBeDefined();
    expect(style.fontWeight, `textRoles.${role}.fontWeight`).toBeDefined();
  }

  expect(theme.shadows.card).toBeDefined();
  expect(theme.shadows.elevated).toBeDefined();
  expect(theme.shadows.none).toBeDefined();
  expect(theme.statusBarStyle).toMatch(/^(light|dark)$/);
  expect(theme.navigationBarStyle).toMatch(/^(light|dark)$/);
}

describe('theme contract', () => {
  it('light theme fulfills the full contract', () => {
    assertThemeContract(lightTheme);
    expect(lightTheme.mode).toBe('light');
    expect(lightTheme.colors.background).toBe('#FAFAF8');
    expect(lightTheme.colors.accent).toBe('#6D5DF6');
  });

  it('dark theme fulfills the same contract', () => {
    assertThemeContract(darkTheme);
    expect(darkTheme.mode).toBe('dark');
    expect(darkTheme.colors.background).toBe('#111214');
    expect(darkTheme.colors.accent).toBe('#7C3AED');
  });

  it('light and dark expose identical color role keys', () => {
    expect(Object.keys(lightTheme.colorRoles).sort()).toEqual(
      Object.keys(darkTheme.colorRoles).sort(),
    );
  });

  it('light and dark expose identical text role keys', () => {
    expect(Object.keys(lightTheme.typography.textRoles).sort()).toEqual(
      Object.keys(darkTheme.typography.textRoles).sort(),
    );
  });
});

describe('resolveThemeMode', () => {
  it('resolves light explicitly', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light');
  });

  it('resolves dark explicitly', () => {
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });

  it('system follows light system preference', () => {
    expect(resolveThemeMode('system', 'light')).toBe('light');
  });

  it('system follows dark system preference', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
  });

  it('system defaults to dark when preference is unavailable', () => {
    expect(resolveThemeMode('system', null)).toBe('dark');
    expect(resolveThemeMode('system', undefined)).toBe('dark');
  });
});

describe('getThemeForMode', () => {
  it('returns light theme for light mode', () => {
    expect(getThemeForMode('light', { light: lightTheme, dark: darkTheme })).toBe(lightTheme);
  });

  it('returns dark theme for dark mode', () => {
    expect(getThemeForMode('dark', { light: lightTheme, dark: darkTheme })).toBe(darkTheme);
  });
});

describe('navigation and status bar integration', () => {
  it('navigation theme receives correct light colors', () => {
    const nav = resolveNavigationTheme(lightTheme);
    expect(nav.dark).toBe(false);
    expect(nav.colors.background).toBe(lightTheme.colors.background);
    expect(nav.colors.primary).toBe(lightTheme.colors.accent);
    expect(nav.colors.text).toBe(lightTheme.colors.textPrimary);
  });

  it('navigation theme receives correct dark colors', () => {
    const nav = resolveNavigationTheme(darkTheme);
    expect(nav.dark).toBe(true);
    expect(nav.colors.background).toBe(darkTheme.colors.background);
    expect(nav.colors.primary).toBe(darkTheme.colors.accent);
  });

  it('status bar style resolves to dark icons on light theme', () => {
    expect(resolveStatusBarStyle(lightTheme)).toBe('dark');
  });

  it('status bar style resolves to light icons on dark theme', () => {
    expect(resolveStatusBarStyle(darkTheme)).toBe('light');
  });

  it('navigation bar style follows theme mode', () => {
    expect(resolveNavigationBarStyle(lightTheme)).toBe('dark');
    expect(resolveNavigationBarStyle(darkTheme)).toBe('light');
  });
});

describe('AppText role resolution', () => {
  it('resolves all roles for light theme without undefined values', () => {
    const roles = createTextRoles(lightTheme.colors);
    for (const role of APP_TEXT_ROLES as readonly AppTextRole[]) {
      expect(roles[role]).toBeDefined();
      expect(roles[role].color).toBeDefined();
    }
  });

  it('resolves all roles for dark theme without undefined values', () => {
    const roles = createTextRoles(darkTheme.colors);
    for (const role of APP_TEXT_ROLES as readonly AppTextRole[]) {
      expect(roles[role]).toBeDefined();
      expect(roles[role].color).toBeDefined();
    }
  });

  it('maps semantic hierarchy roles to expected sizes', () => {
    const roles = createTextRoles(lightTheme.colors);
    expect(roles.titleLarge.fontSize).toBe(24);
    expect(roles.titleMedium.fontSize).toBe(20);
    expect(roles.body.fontSize).toBe(16);
    expect(roles.caption.fontSize).toBe(13);
  });
});

describe('ThemeProvider', () => {
  it('assertThemeContext throws outside provider', () => {
    expect(() => assertThemeContext(null)).toThrow(/ThemeProvider/);
  });

  it('setMode changes resolved preference', () => {
    let mode: 'light' | 'dark' | 'system' = 'system';
    const setMode = (next: typeof mode) => {
      mode = next;
    };

    setMode('light');
    expect(resolveThemeMode(mode, 'dark')).toBe('light');

    setMode('dark');
    expect(resolveThemeMode(mode, 'light')).toBe('dark');
  });

  it('ThemeProvider starts with system preference by default', () => {
    expect(resolveThemeMode('system', 'light')).toBe('light');
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
  });
});
