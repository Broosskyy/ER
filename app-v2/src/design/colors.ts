/**
 * Eternal Rave color tokens — V1 preliminary.
 *
 * Sources:
 * - reference/old-code/src/constants/theme.ts
 * - reference/docs/export-docs/02-ui-design/MOCKUP-SCREENS.md
 * - reference/mockups/screens/62_DesignSystem_Color_System.jpg
 * - V1 core screens 09–15, UI libraries 52–57
 */
export const colors = {
  // Brand & primary actions
  primary: '#7C3AED',
  primaryHighlight: '#A855F7',
  primaryDeep: '#4C1D95',

  // Surfaces
  background: '#0B0B0F',
  surface: '#15151B',
  surfaceElevated: '#1F1F27',
  mapSurface: '#12121A',

  // Text
  textPrimary: '#F5F5F5',
  textSecondary: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  // Borders & dividers
  border: '#2A2A35',
  divider: '#2A2A35',

  // Semantic status
  live: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',

  // Utility
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

/**
 * Semantic color roles for recurring V1 UI patterns.
 * Values map to base tokens above — no new hues invented.
 */
export const colorRoles = {
  appBackground: colors.background,
  screenBackground: colors.background,

  headerBackground: colors.background,
  headerTitle: colors.textPrimary,
  headerIcon: colors.textPrimary,

  bottomNavBackground: colors.surface,
  bottomNavBorder: colors.border,
  bottomNavActive: colors.primary,
  bottomNavInactive: colors.textSecondary,

  searchBackground: colors.surface,
  searchBorder: colors.border,
  searchPlaceholder: colors.textSecondary,
  searchText: colors.textPrimary,

  chipBackground: colors.surface,
  chipBorder: colors.border,
  chipText: colors.textSecondary,
  chipSelectedBackground: colors.primary,
  chipSelectedBorder: colors.primary,
  chipSelectedText: colors.textOnPrimary,

  cardBackground: colors.surface,
  cardBorder: colors.border,

  buttonPrimaryBackground: colors.primary,
  buttonPrimaryText: colors.textOnPrimary,
  buttonPrimaryPressed: colors.primaryHighlight,
  buttonSecondaryBackground: colors.transparent,
  buttonSecondaryBorder: colors.border,
  buttonSecondaryText: colors.textPrimary,

  badgeBackground: colors.surfaceElevated,
  badgeText: colors.textSecondary,
  tagBackground: colors.surfaceElevated,
  tagText: colors.textSecondary,

  favoriteActive: colors.live,
  favoriteInactive: colors.textSecondary,

  mapCluster: colors.primary,
  mapUserLocation: '#3B82F6', // REVIEW: blue dot visible on 12_Map.jpg; exact hex unclear

  overlayScrim: 'rgba(11, 11, 15, 0.72)', // REVIEW: approximate from 12_Map bottom sheet
  imageOverlayGradientStart: 'rgba(11, 11, 15, 0)',
  imageOverlayGradientEnd: 'rgba(11, 11, 15, 0.85)', // REVIEW: hero fade on 11_Event_Details.jpg

  emptyStateIcon: colors.textSecondary,
  emptyStateTitle: colors.textPrimary,
  emptyStateDescription: colors.textSecondary,

  skeletonBase: colors.surface,
  skeletonHighlight: colors.surfaceElevated,
} as const;

export const opacity = {
  disabled: 0.5,
  pressed: 0.88,
  overlay: 0.72, // REVIEW
} as const;

export type ColorToken = keyof typeof colors;
export type ColorRole = keyof typeof colorRoles;
