import type { ThemeColors } from '../types';

/**
 * Warm, content-first light palette — ER_COLOR_AND_THEME.md §4.
 */
export const lightColors: ThemeColors = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F5F5',
  surfaceSubtle: '#F3F3F0',

  textPrimary: '#111111',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnAccent: '#FFFFFF',

  borderSubtle: '#E5E7EB',
  borderStrong: '#D1D5DB',

  accent: '#6D5DF6',
  accentPressed: '#5B4DE0',
  accentMuted: 'rgba(109, 93, 246, 0.12)',

  destructive: '#EF4444',
  destructiveMuted: 'rgba(239, 68, 68, 0.12)',
  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.12)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.12)',
  info: '#3B82F6',

  overlay: 'rgba(17, 18, 20, 0.48)',
  skeletonBase: '#F3F3F0',
  skeletonHighlight: '#F5F5F5',

  primary: '#6D5DF6',
  primaryHighlight: '#7C6FF7',
  primaryDeep: '#4C3DB8',
  border: '#E5E7EB',
  divider: '#F3F4F6',
  textOnPrimary: '#FFFFFF',
  live: '#EF4444',
  mapSurface: '#F3F3F0',
  transparent: 'transparent',
  white: '#FFFFFF',
};
