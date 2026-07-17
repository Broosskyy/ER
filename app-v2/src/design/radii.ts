/**
 * Eternal Rave border radius tokens.
 * Source: reference/old-code/src/constants/theme.ts (BorderRadius)
 */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export type RadiiToken = keyof typeof radii;
