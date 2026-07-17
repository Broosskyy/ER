/**
 * Eternal Rave spacing tokens.
 * Source: reference/old-code/src/constants/theme.ts (Spacing)
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screen: 16,
} as const;

export type SpacingToken = keyof typeof spacing;
