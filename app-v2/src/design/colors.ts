/**
 * Legacy color tokens — backward-compatible re-exports from the dark theme.
 *
 * New code should use `useTheme().theme.colors` from `@/design/theme`.
 */
import { darkThemeColors } from '@/design/theme/palettes';

export const colors = {
  primary: darkThemeColors.accent,
  primaryHighlight: darkThemeColors.accentPressed,
  primaryDeep: '#5B4FCF',
  background: darkThemeColors.background,
  surface: darkThemeColors.surface,
  surfaceElevated: darkThemeColors.surfaceElevated,
  surfaceSubtle: darkThemeColors.surfaceSubtle,
  mapSurface: darkThemeColors.mapSurface,
  textPrimary: darkThemeColors.textPrimary,
  textSecondary: darkThemeColors.textSecondary,
  textOnPrimary: darkThemeColors.textOnAccent,
  border: darkThemeColors.borderSubtle,
  divider: darkThemeColors.borderSubtle,
  live: darkThemeColors.destructive,
  success: darkThemeColors.success,
  warning: darkThemeColors.warning,
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

export const colorRoles = {
  appBackground: darkThemeColors.background,
  screenBackground: darkThemeColors.background,
  headerBackground: darkThemeColors.background,
  headerTitle: darkThemeColors.textPrimary,
  headerIcon: darkThemeColors.textPrimary,
  bottomNavBackground: darkThemeColors.surface,
  bottomNavBorder: darkThemeColors.borderSubtle,
  bottomNavActive: darkThemeColors.accent,
  bottomNavInactive: darkThemeColors.textMuted,
  searchBackground: darkThemeColors.surface,
  searchBorder: darkThemeColors.borderSubtle,
  searchPlaceholder: darkThemeColors.textSecondary,
  searchText: darkThemeColors.textPrimary,
  chipBackground: darkThemeColors.surface,
  chipBorder: darkThemeColors.borderSubtle,
  chipText: darkThemeColors.textSecondary,
  chipSelectedBackground: darkThemeColors.accentMuted,
  chipSelectedBorder: darkThemeColors.accent,
  chipSelectedText: darkThemeColors.accent,
  cardBackground: darkThemeColors.surface,
  cardBorder: darkThemeColors.borderSubtle,
  buttonPrimaryBackground: darkThemeColors.accent,
  buttonPrimaryText: darkThemeColors.textOnAccent,
  buttonPrimaryPressed: darkThemeColors.accentPressed,
  buttonSecondaryBackground: colors.transparent,
  buttonSecondaryBorder: darkThemeColors.borderSubtle,
  buttonSecondaryText: darkThemeColors.textPrimary,
  badgeBackground: darkThemeColors.surfaceElevated,
  badgeText: darkThemeColors.textSecondary,
  tagBackground: darkThemeColors.surfaceElevated,
  tagText: darkThemeColors.textSecondary,
  favoriteActive: darkThemeColors.destructive,
  favoriteInactive: darkThemeColors.textSecondary,
  mapCluster: darkThemeColors.accent,
  mapUserLocation: darkThemeColors.info,
  overlayScrim: darkThemeColors.overlay,
  imageOverlayGradientStart: 'rgba(11, 11, 15, 0)',
  imageOverlayGradientEnd: 'rgba(16, 17, 20, 0.85)',
  emptyStateIcon: darkThemeColors.textSecondary,
  emptyStateTitle: darkThemeColors.textPrimary,
  emptyStateDescription: darkThemeColors.textSecondary,
  skeletonBase: darkThemeColors.skeletonBase,
  skeletonHighlight: darkThemeColors.skeletonHighlight,
} as const;

export const opacity = {
  disabled: 0.5,
  pressed: 0.88,
  overlay: 0.72,
} as const;

export type ColorToken = keyof typeof colors;
export type ColorRole = keyof typeof colorRoles;
