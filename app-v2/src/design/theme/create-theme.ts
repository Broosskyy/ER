import { layout } from '@/design/layout';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { fontSize, fontWeight, lineHeight } from '@/design/typography';

import type {
  EternalRaveTheme,
  LegacyColorRoles,
  ResolvedThemeMode,
  ThemeColors,
  ThemeShadows,
  ThemeTextRoles,
  ThemeTypography,
} from './types';

function createLegacyColorRoles(colors: ThemeColors): LegacyColorRoles {
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
    searchBackground: colors.surface,
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
    buttonSecondaryBackground: 'transparent',
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
    imageOverlayGradientEnd: colors.overlay,
    emptyStateIcon: colors.textSecondary,
    emptyStateTitle: colors.textPrimary,
    emptyStateDescription: colors.textSecondary,
    skeletonBase: colors.skeletonBase,
    skeletonHighlight: colors.skeletonHighlight,
  };
}

function createTypographyRoles(colors: ThemeColors): ThemeTextRoles {
  const titleLarge = {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: fontSize.xxl * lineHeight.tight,
  };
  const titleMedium = {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: fontSize.xl * lineHeight.tight,
  };
  const titleSmall = {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: fontSize.md * lineHeight.tight,
  };
  const body = {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    color: colors.textPrimary,
    lineHeight: fontSize.md * lineHeight.normal,
  };
  const bodyMuted = {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: fontSize.base * lineHeight.normal,
  };

  return {
    display: {
      fontSize: fontSize.display,
      fontWeight: fontWeight.bold,
      color: colors.textPrimary,
      lineHeight: fontSize.display * lineHeight.tight,
    },
    titleLarge,
    titleMedium,
    titleSmall,
    body,
    bodyStrong: {
      ...body,
      fontWeight: fontWeight.semibold,
    },
    bodyMuted,
    label: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.textSecondary,
      lineHeight: fontSize.sm * lineHeight.normal,
    },
    caption: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.regular,
      color: colors.textMuted,
      lineHeight: fontSize.sm * lineHeight.normal,
    },
    screenTitle: titleLarge,
    sectionTitle: titleMedium,
    cardTitle: titleSmall,
    cardSubtitle: bodyMuted,
    metadata: bodyMuted,
    button: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.textOnAccent,
      lineHeight: fontSize.md * lineHeight.tight,
    },
    chip: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.medium,
      color: colors.textSecondary,
      lineHeight: fontSize.base * lineHeight.tight,
    },
    chipSelected: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: colors.textOnAccent,
      lineHeight: fontSize.base * lineHeight.tight,
    },
    navLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: colors.textSecondary,
      lineHeight: fontSize.xs * lineHeight.tight,
    },
    navLabelActive: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.accent,
      lineHeight: fontSize.xs * lineHeight.tight,
    },
    badge: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.textSecondary,
      lineHeight: fontSize.caption * lineHeight.tight,
    },
    searchInput: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.regular,
      color: colors.textPrimary,
      lineHeight: fontSize.base * lineHeight.normal,
    },
    searchPlaceholder: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.regular,
      color: colors.textSecondary,
      lineHeight: fontSize.base * lineHeight.normal,
    },
  };
}

function createTypography(colors: ThemeColors): ThemeTypography {
  return {
    roles: createTypographyRoles(colors),
  };
}

export function createEternalRaveTheme(
  mode: ResolvedThemeMode,
  colors: ThemeColors,
  shadows: ThemeShadows,
  statusBarStyle: 'light' | 'dark',
): EternalRaveTheme {
  return {
    mode,
    colors,
    colorRoles: createLegacyColorRoles(colors),
    typography: createTypography(colors),
    spacing,
    radii,
    layout,
    shadows,
    statusBarStyle,
  };
}
