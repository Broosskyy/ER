/**
 * Eternal Rave color tokens — backward-compatible dark defaults.
 *
 * New theme-aware code should use `useTheme()` from `@/design/theme`.
 * Static exports mirror the Evolution V2 dark palette.
 */
import { buildColorRoles } from './theme/createTheme';
import { darkColors } from './theme/palettes/darkColors';

export const colors = {
  primary: darkColors.primary,
  primaryHighlight: darkColors.primaryHighlight,
  primaryDeep: darkColors.primaryDeep,

  background: darkColors.background,
  surface: darkColors.surface,
  surfaceElevated: darkColors.surfaceElevated,
  mapSurface: darkColors.mapSurface,

  textPrimary: darkColors.textPrimary,
  textSecondary: darkColors.textSecondary,
  textOnPrimary: darkColors.textOnPrimary,

  border: darkColors.border,
  divider: darkColors.divider,

  live: darkColors.live,
  success: darkColors.success,
  warning: darkColors.warning,

  white: darkColors.white,
  transparent: darkColors.transparent,
} as const;

/**
 * Semantic color roles for recurring V1 UI patterns.
 * Values map to the active dark theme — use `useTheme().theme.colorRoles` when theme-aware.
 */
export const colorRoles = buildColorRoles(darkColors, 'dark');

export const opacity = {
  disabled: 0.5,
  pressed: 0.88,
  overlay: 0.72,
} as const;

export type ColorToken = keyof typeof colors;
export type ColorRole = keyof typeof colorRoles;
