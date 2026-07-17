/**
 * Eternal Rave border radius tokens — V1 preliminary.
 *
 * Sources:
 * - reference/old-code/src/constants/theme.ts (BorderRadius)
 * - MOCKUP-SCREENS.md: "~12–16px on cards and buttons"
 * - reference/mockups/screens/65_DesignSystem_Radius_Elevation.jpg
 */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

/**
 * Semantic radius mapping for V1 components.
 */
export const radiusRoles = {
  button: radii.md,
  searchField: radii.md,
  chip: radii.full,
  card: radii.lg,
  eventThumbnail: radii.md,
  badge: radii.sm,
  iconButton: radii.full,
  bottomSheet: radii.xl,
  mapPreview: radii.md,
} as const;

export const borderWidth = {
  hairline: 1,
} as const;

export type RadiiToken = keyof typeof radii;
export type RadiusRole = keyof typeof radiusRoles;
