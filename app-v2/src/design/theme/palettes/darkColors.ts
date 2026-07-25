import type { ThemeColors } from '../types';

/**
 * Evolution V2 dark palette — ER_COLOR_AND_THEME.md §3 + ER_DESIGN_EVOLUTION_V2.md.
 */
export const darkColors: ThemeColors = {
  background: '#111214',
  surface: '#1A1C1F',
  surfaceElevated: '#24272C',
  surfaceSubtle: '#16181B',

  textPrimary: '#F5F5F5',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textOnAccent: '#FFFFFF',

  borderSubtle: '#2A2D32',
  borderStrong: '#353A42',

  accent: '#7C3AED',
  accentPressed: '#A855F7',
  accentMuted: 'rgba(124, 58, 237, 0.16)',

  destructive: '#EF4444',
  destructiveMuted: 'rgba(239, 68, 68, 0.16)',
  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.16)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.16)',
  info: '#3B82F6',

  overlay: 'rgba(11, 11, 15, 0.72)',
  skeletonBase: '#1A1C1F',
  skeletonHighlight: '#24272C',

  primary: '#7C3AED',
  primaryHighlight: '#A855F7',
  primaryDeep: '#4C1D95',
  border: '#2A2D32',
  divider: '#2A2D32',
  textOnPrimary: '#FFFFFF',
  live: '#EF4444',
  mapSurface: '#12121A',
  transparent: 'transparent',
  white: '#FFFFFF',
};
