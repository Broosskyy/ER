/**
 * Eternal Rave spacing tokens — V1 preliminary.
 *
 * Sources:
 * - reference/old-code/src/constants/theme.ts (Spacing)
 * - reference/mockups/screens/64_DesignSystem_Spacing_Grid.jpg
 * - recurring rhythm on 09_Home.jpg, 10_Events.jpg, 13_Search_Filter.jpg
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

/**
 * Semantic spacing for V1 layouts.
 * Uses base scale only — no arbitrary one-off values.
 */
export const spacingRoles = {
  /** Horizontal screen padding — consistent across Home, Events, Saved, Profile */
  screenHorizontal: spacing.screen,

  /** Vertical gap between major sections (e.g. filter row → featured → list) */
  sectionGap: spacing.xxl,

  /** Gap between section title and its content */
  sectionTitleGap: spacing.md,

  /** Vertical gap between list rows / event cards */
  listItemGap: spacing.md,

  /** Inner padding for cards and surface containers */
  cardPadding: spacing.lg,

  /** Horizontal gap between filter chips */
  chipGap: spacing.sm,

  /** Inline gap between icon and label */
  inlineGap: spacing.sm,

  /** Vertical stack gap inside cards */
  cardContentGap: spacing.sm,

  /** Search field horizontal padding */
  searchPaddingHorizontal: spacing.lg,

  /** Bottom nav top padding above icons */
  bottomNavPaddingTop: spacing.sm,

  /** Header action cluster gap */
  headerActionGap: spacing.sm,
} as const;

export type SpacingToken = keyof typeof spacing;
export type SpacingRole = keyof typeof spacingRoles;
