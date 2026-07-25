/**
 * Eternal Rave border radius tokens — Sprint 2B consumer refinement.
 *
 * Softer radii for a premium 2026 consumer feel while preserving layout dimensions.
 */
export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  full: 9999,
} as const;

/**
 * Semantic radius mapping for V1 components.
 */
export const radiusRoles = {
  button: 15,
  searchField: 20,
  chip: radii.md,
  card: radii.lg,
  eventThumbnail: radii.md,
  badge: radii.sm,
  iconButton: radii.full,
  bottomSheet: radii.xl,
  bottomNav: radii.xl,
  mapPreview: radii.md,
} as const;

export const borderWidth = {
  hairline: 1,
} as const;

export type RadiiToken = keyof typeof radii;
export type RadiusRole = keyof typeof radiusRoles;
