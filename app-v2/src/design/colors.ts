/**
 * Eternal Rave color tokens.
 * Source: reference/old-code/src/constants/theme.ts (Colors)
 */
export const colors = {
  background: '#0B0B0F',
  surface: '#15151B',
  surfaceElevated: '#1F1F27',
  mapSurface: '#12121A',
  primary: '#7C3AED',
  primaryHighlight: '#A855F7',
  primaryDeep: '#4C1D95',
  textPrimary: '#F5F5F5',
  textSecondary: '#9CA3AF',
  border: '#2A2A35',
  live: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
