import type { TextStyle } from 'react-native';

import type { layout } from '../layout';
import type { radiusRoles, radii } from '../radii';
import type { spacing, spacingRoles } from '../spacing';
import type { fontFamily, fontSize, fontWeight, lineHeight } from '../typography';

export type ThemeModePreference = 'light' | 'dark' | 'system';

export type ResolvedThemeMode = 'light' | 'dark';

/**
 * Semantic color contract shared by light and dark themes.
 * Components should consume these roles — never raw hex values.
 */
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSubtle: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;

  borderSubtle: string;
  borderStrong: string;

  accent: string;
  accentPressed: string;
  accentMuted: string;

  destructive: string;
  destructiveMuted: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  info: string;

  overlay: string;
  skeletonBase: string;
  skeletonHighlight: string;

  /** Legacy aliases — prefer semantic names in new code */
  primary: string;
  primaryHighlight: string;
  primaryDeep: string;
  border: string;
  divider: string;
  textOnPrimary: string;
  live: string;
  mapSurface: string;
  transparent: string;
  white: string;
}

export interface ThemeColorRoles {
  appBackground: string;
  screenBackground: string;
  headerBackground: string;
  headerTitle: string;
  headerIcon: string;
  bottomNavBackground: string;
  bottomNavBorder: string;
  bottomNavActive: string;
  bottomNavInactive: string;
  searchBackground: string;
  searchBorder: string;
  searchPlaceholder: string;
  searchText: string;
  chipBackground: string;
  chipBorder: string;
  chipText: string;
  chipSelectedBackground: string;
  chipSelectedBorder: string;
  chipSelectedText: string;
  cardBackground: string;
  cardBorder: string;
  buttonPrimaryBackground: string;
  buttonPrimaryText: string;
  buttonPrimaryPressed: string;
  buttonSecondaryBackground: string;
  buttonSecondaryBorder: string;
  buttonSecondaryText: string;
  badgeBackground: string;
  badgeText: string;
  tagBackground: string;
  tagText: string;
  favoriteActive: string;
  favoriteInactive: string;
  mapCluster: string;
  mapUserLocation: string;
  overlayScrim: string;
  imageOverlayGradientStart: string;
  imageOverlayGradientEnd: string;
  emptyStateIcon: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  skeletonBase: string;
  skeletonHighlight: string;
}

export type AppTextRole =
  | 'display'
  | 'titleLarge'
  | 'titleMedium'
  | 'titleSmall'
  | 'body'
  | 'bodyStrong'
  | 'bodyMuted'
  | 'label'
  | 'caption'
  | 'screenTitle'
  | 'sectionTitle'
  | 'cardTitle'
  | 'cardSubtitle'
  | 'metadata'
  | 'button'
  | 'chip'
  | 'chipSelected'
  | 'navLabel'
  | 'navLabelActive'
  | 'searchInput'
  | 'searchPlaceholder'
  | 'badge';

export interface ThemeTypography {
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  lineHeight: typeof lineHeight;
  fontFamily: typeof fontFamily;
  textRoles: Record<AppTextRole, TextStyle>;
}

export interface ThemeShadows {
  none: object;
  card: object;
  elevated: object;
}

export interface Theme {
  mode: ResolvedThemeMode;
  colors: ThemeColors;
  colorRoles: ThemeColorRoles;
  typography: ThemeTypography;
  spacing: typeof spacing;
  spacingRoles: typeof spacingRoles;
  radii: typeof radii;
  radiusRoles: typeof radiusRoles;
  layout: typeof layout;
  shadows: ThemeShadows;
  statusBarStyle: 'light' | 'dark';
  navigationBarStyle: 'light' | 'dark';
}

export interface ThemeContextValue {
  theme: Theme;
  mode: ThemeModePreference;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: ThemeModePreference) => void;
}

export interface NavigationThemeColors {
  background: string;
  card: string;
  border: string;
  primary: string;
  text: string;
  notification: string;
}

export interface ResolvedNavigationTheme {
  dark: boolean;
  colors: NavigationThemeColors;
}
