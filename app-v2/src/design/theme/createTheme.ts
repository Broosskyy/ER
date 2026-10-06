import type { TextStyle } from 'react-native';

import { shadows as darkShadowTokens } from '../shadows';
import { layout } from '../layout';
import { radiusRoles, radii } from '../radii';
import { spacing, spacingRoles } from '../spacing';
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from '../typography';

import type {
  AppTextRole,
  ResolvedThemeMode,
  Theme,
  ThemeColorRoles,
  ThemeColors,
  ThemeShadows,
  ThemeTypography,
} from './types';

function roleStyle(
  partial: TextStyle,
  color: string,
): TextStyle {
  return { ...partial, color };
}

export function createTextRoles(colors: ThemeColors): Record<AppTextRole, TextStyle> {
  return {
    display: roleStyle(
      {
        fontSize: fontSize.display,
        fontWeight: fontWeight.bold,
        lineHeight: fontSize.display * lineHeight.tight,
      },
      colors.textPrimary,
    ),
    titleLarge: roleStyle(
      {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.bold,
        lineHeight: fontSize.xxl * lineHeight.tight,
      },
      colors.textPrimary,
    ),
    titleMedium: roleStyle(
      {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.semibold,
        lineHeight: fontSize.xl * lineHeight.tight,
      },
      colors.textPrimary,
    ),
    titleSmall: roleStyle(
      {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        lineHeight: fontSize.md * lineHeight.tight,
      },
      colors.textPrimary,
    ),
    body: roleStyle(
      {
        fontSize: fontSize.md,
        fontWeight: fontWeight.regular,
        lineHeight: fontSize.md * lineHeight.normal,
      },
      colors.textPrimary,
    ),
    bodyStrong: roleStyle(
      {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        lineHeight: fontSize.md * lineHeight.normal,
      },
      colors.textPrimary,
    ),
    bodyMuted: roleStyle(
      {
        fontSize: fontSize.md,
        fontWeight: fontWeight.regular,
        lineHeight: fontSize.md * lineHeight.normal,
      },
      colors.textSecondary,
    ),
    label: roleStyle(
      {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.medium,
        lineHeight: fontSize.sm * lineHeight.normal,
      },
      colors.textSecondary,
    ),
    caption: roleStyle(
      {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.regular,
        lineHeight: fontSize.sm * lineHeight.normal,
      },
      colors.textMuted,
    ),
    screenTitle: roleStyle(
      {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.bold,
        lineHeight: fontSize.xxl * lineHeight.tight,
      },
      colors.textPrimary,
    ),
    sectionTitle: roleStyle(
      {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.semibold,
        lineHeight: fontSize.xl * lineHeight.tight,
      },
      colors.textPrimary,
    ),
    cardTitle: roleStyle(
      {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        lineHeight: fontSize.md * lineHeight.tight,
      },
      colors.textPrimary,
    ),
    cardSubtitle: roleStyle(
      {
        fontSize: fontSize.base,
        fontWeight: fontWeight.regular,
        lineHeight: fontSize.base * lineHeight.normal,
      },
      colors.textSecondary,
    ),
    metadata: roleStyle(
      {
        fontSize: fontSize.base,
        fontWeight: fontWeight.regular,
        lineHeight: fontSize.base * lineHeight.normal,
      },
      colors.textSecondary,
    ),
    button: roleStyle(
      {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        lineHeight: fontSize.md * lineHeight.tight,
      },
      colors.textOnAccent,
    ),
    chip: roleStyle(
      {
        fontSize: fontSize.base,
        fontWeight: fontWeight.medium,
        lineHeight: fontSize.base * lineHeight.tight,
      },
      colors.textSecondary,
    ),
    chipSelected: roleStyle(
      {
        fontSize: fontSize.base,
        fontWeight: fontWeight.semibold,
        lineHeight: fontSize.base * lineHeight.tight,
      },
      colors.textOnAccent,
    ),
    navLabel: roleStyle(
      {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.medium,
        lineHeight: fontSize.xs * lineHeight.tight,
      },
      colors.textSecondary,
    ),
    navLabelActive: roleStyle(
      {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        lineHeight: fontSize.xs * lineHeight.tight,
      },
      colors.accent,
    ),
    searchInput: roleStyle(
      {
        fontSize: fontSize.base,
        fontWeight: fontWeight.regular,
        lineHeight: fontSize.base * lineHeight.normal,
      },
      colors.textPrimary,
    ),
    searchPlaceholder: roleStyle(
      {
        fontSize: fontSize.base,
        fontWeight: fontWeight.regular,
        lineHeight: fontSize.base * lineHeight.normal,
      },
      colors.textSecondary,
    ),
    badge: roleStyle(
      {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.semibold,
        lineHeight: fontSize.caption * lineHeight.tight,
      },
      colors.textSecondary,
    ),
  };
}

export function buildColorRoles(
  colors: ThemeColors,
  mode: ResolvedThemeMode,
): ThemeColorRoles {
  return {
    appBackground: colors.background,
    screenBackground: colors.background,
    headerBackground: colors.background,
    headerTitle: colors.textPrimary,
    headerIcon: colors.textPrimary,
    bottomNavBackground: colors.surface,
    bottomNavBorder: colors.borderSubtle,
    bottomNavActive: colors.accent,
    bottomNavInactive: colors.textSecondary,
    searchBackground: colors.surfaceSubtle,
    searchBorder: colors.borderSubtle,
    searchPlaceholder: colors.textSecondary,
    searchText: colors.textPrimary,
    chipBackground: colors.surface,
    chipBorder: colors.borderSubtle,
    chipText: colors.textSecondary,
    chipSelectedBackground: colors.accent,
    chipSelectedBorder: colors.accent,
    chipSelectedText: colors.textOnAccent,
    cardBackground: colors.surface,
    cardBorder: colors.borderSubtle,
    buttonPrimaryBackground: colors.accent,
    buttonPrimaryText: colors.textOnAccent,
    buttonPrimaryPressed: colors.accentPressed,
    buttonSecondaryBackground: colors.transparent,
    buttonSecondaryBorder: colors.borderSubtle,
    buttonSecondaryText: colors.textPrimary,
    badgeBackground: colors.surfaceElevated,
    badgeText: colors.textSecondary,
    tagBackground: colors.surfaceElevated,
    tagText: colors.textSecondary,
    favoriteActive: colors.destructive,
    favoriteInactive: colors.textSecondary,
    mapCluster: colors.accent,
    mapUserLocation: colors.info,
    overlayScrim: colors.overlay,
    imageOverlayGradientStart: 'rgba(0, 0, 0, 0)',
    imageOverlayGradientEnd:
      mode === 'dark' ? 'rgba(17, 18, 20, 0.85)' : 'rgba(250, 250, 248, 0.6)',
    emptyStateIcon: colors.textSecondary,
    emptyStateTitle: colors.textPrimary,
    emptyStateDescription: colors.textSecondary,
    skeletonBase: colors.skeletonBase,
    skeletonHighlight: colors.skeletonHighlight,
  };
}

export function createLightShadows(): ThemeShadows {
  return {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    card: {
      shadowColor: '#111214',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    elevated: {
      shadowColor: '#111214',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  };
}

export function createDarkShadows(): ThemeShadows {
  return {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    card: {
      ...darkShadowTokens.card,
      shadowOpacity: 0.12,
    },
    elevated: {
      ...darkShadowTokens.elevated,
      shadowOpacity: 0.18,
    },
  };
}

function createTypography(colors: ThemeColors): ThemeTypography {
  return {
    fontSize,
    fontWeight,
    lineHeight,
    fontFamily,
    textRoles: createTextRoles(colors),
  };
}

export function createTheme(
  mode: ResolvedThemeMode,
  colors: ThemeColors,
): Theme {
  const shadows = mode === 'light' ? createLightShadows() : createDarkShadows();

  return {
    mode,
    colors,
    colorRoles: buildColorRoles(colors, mode),
    typography: createTypography(colors),
    spacing,
    spacingRoles,
    radii,
    radiusRoles,
    layout,
    shadows,
    statusBarStyle: mode === 'dark' ? 'light' : 'dark',
    navigationBarStyle: mode === 'dark' ? 'light' : 'dark',
  };
}

export const APP_TEXT_ROLES = [
  'display',
  'titleLarge',
  'titleMedium',
  'titleSmall',
  'body',
  'bodyStrong',
  'bodyMuted',
  'label',
  'caption',
  'screenTitle',
  'sectionTitle',
  'cardTitle',
  'cardSubtitle',
  'metadata',
  'button',
  'chip',
  'chipSelected',
  'navLabel',
  'navLabelActive',
  'searchInput',
  'searchPlaceholder',
  'badge',
] as const satisfies readonly AppTextRole[];

export const THEME_COLOR_KEYS = [
  'background',
  'surface',
  'surfaceElevated',
  'surfaceSubtle',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'textOnAccent',
  'borderSubtle',
  'borderStrong',
  'accent',
  'accentPressed',
  'accentMuted',
  'destructive',
  'destructiveMuted',
  'success',
  'successMuted',
  'warning',
  'warningMuted',
  'info',
  'overlay',
  'skeletonBase',
  'skeletonHighlight',
  'primary',
  'primaryHighlight',
  'primaryDeep',
  'border',
  'divider',
  'textOnPrimary',
  'live',
  'mapSurface',
  'transparent',
  'white',
] as const satisfies readonly (keyof ThemeColors)[];
