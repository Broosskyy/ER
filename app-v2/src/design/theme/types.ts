import type { TextStyle } from 'react-native';

import type { layout } from '@/design/layout';
import type { radii } from '@/design/radii';
import type { spacing } from '@/design/spacing';

export interface NavigationTheme {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
  };
  fonts: {
    regular: { fontFamily: string; fontWeight: '400' };
    medium: { fontFamily: string; fontWeight: '500' };
    bold: { fontFamily: string; fontWeight: '700' };
    heavy: { fontFamily: string; fontWeight: '800' };
  };
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type ResolvedThemeMode = 'light' | 'dark';

export type StatusBarStyle = 'light' | 'dark' | 'auto';

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
  overlay: string;
  skeletonBase: string;
  skeletonHighlight: string;
  mapSurface: string;
  info: string;
}

export interface LegacyColorRoles {
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

export type TextRole =
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
  | 'badge'
  | 'searchInput'
  | 'searchPlaceholder';

export type ThemeTextRoles = Record<TextRole, TextStyle>;

export interface ThemeTypography {
  roles: ThemeTextRoles;
}

export interface ThemeShadows {
  none: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  card: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  elevated: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

export interface EternalRaveTheme {
  mode: ResolvedThemeMode;
  colors: ThemeColors;
  colorRoles: LegacyColorRoles;
  typography: ThemeTypography;
  spacing: typeof spacing;
  radii: typeof radii;
  layout: typeof layout;
  shadows: ThemeShadows;
  statusBarStyle: StatusBarStyle;
}

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
  'overlay',
  'skeletonBase',
  'skeletonHighlight',
  'mapSurface',
  'info',
] as const satisfies ReadonlyArray<keyof ThemeColors>;

export const TEXT_ROLE_KEYS = [
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
  'badge',
  'searchInput',
  'searchPlaceholder',
] as const satisfies ReadonlyArray<TextRole>;
