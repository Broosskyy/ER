import { spacing, spacingRoles } from './spacing';

/**
 * Eternal Rave layout & component size tokens — V1 preliminary.
 *
 * Sources:
 * - reference/old-code/src/constants/theme.ts (BOTTOM_NAV_HEIGHT)
 * - reference/docs/export-docs/02-ui-design/MOCKUP-SCREENS.md
 * - reference/mockups/screens/09–15, 52–57
 */
export const layout = {
  bottomNavHeight: 58,
  minTouchTarget: 44,
  maxContentWidth: 480,
  screenPadding: spacing.screen,
  featuredCardPeek: 40,
} as const;

export const appConfig = {
  name: 'Eternal Rave',
  tagline: 'Discover. Connect. Rave.',
  locationLabel: 'Near you',
  defaultCity: 'Berlin',
} as const;

/**
 * Recurring V1 component dimensions from mockup analysis.
 * Values marked REVIEW in DESIGN_GUIDELINES.md where uncertain.
 */
export const componentSize = {
  headerContentHeight: 48,
  searchFieldHeight: 40,
  chipHeight: 34,
  buttonHeight: 48,
  iconButtonSize: 44,
  bottomNavHeight: layout.bottomNavHeight,
  bottomNavIconSize: 22,
  bottomNavIconSizeActive: 24,

  iconSm: 20,
  iconMd: 24,
  iconLg: 28,

  eventListThumbnailWidth: 108,
  eventListThumbnailAspectRatio: 4 / 3,
  eventListRowMinHeight: 96,
  featuredHeroAspectRatio: 16 / 9,
  eventDetailHeroAspectRatio: 16 / 9,
  mapPreviewAspectRatio: 16 / 9,

  mapClusterSize: 40,
  mapClusterSizeLarge: 48,
} as const;

/**
 * V1 component spec summary — structural rules, not implementations.
 */
export const v1Components = {
  appHeader: {
    height: componentSize.headerContentHeight,
    paddingHorizontal: spacingRoles.screenHorizontal,
    backgroundColorRole: 'headerBackground' as const,
  },
  bottomNavigation: {
    height: componentSize.bottomNavHeight,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacingRoles.bottomNavPaddingTop,
    iconSize: componentSize.iconMd,
    labelRole: 'navLabel' as const,
    activeLabelRole: 'navLabelActive' as const,
    tabs: ['home', 'events', 'map', 'saved', 'profile'] as const,
  },
  searchField: {
    height: componentSize.searchFieldHeight,
    paddingHorizontal: spacingRoles.searchPaddingHorizontal,
    borderRadiusRole: 'searchField' as const,
  },
  filterChip: {
    height: componentSize.chipHeight,
    paddingHorizontal: spacing.lg,
    borderRadiusRole: 'chip' as const,
  },
  eventCard: {
    padding: spacingRoles.cardPadding,
    borderRadiusRole: 'card' as const,
    contentGap: spacingRoles.cardContentGap,
  },
  eventListRow: {
    thumbnailWidth: componentSize.eventListThumbnailWidth,
    thumbnailAspectRatio: componentSize.eventListThumbnailAspectRatio,
    gap: spacingRoles.listItemGap,
  },
  primaryButton: {
    height: componentSize.buttonHeight,
    minTouchTarget: layout.minTouchTarget,
    borderRadiusRole: 'button' as const,
  },
  iconButton: {
    size: componentSize.iconButtonSize,
    iconSize: componentSize.iconMd,
    borderRadiusRole: 'iconButton' as const,
  },
} as const;

export type V1Component = keyof typeof v1Components;
