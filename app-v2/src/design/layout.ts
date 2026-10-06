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
  /** Legacy mobile narrow cap — prefer responsive tokens below on web/tablet. */
  maxContentWidth: 480,
  maxContentWidthTablet: 720,
  maxContentWidthDesktop: 960,
  screenPadding: spacing.screen,
  featuredCardPeek: 40,
} as const;

export const appConfig = {
  name: 'Eternal Rave',
  tagline: 'Discover. Connect. Rave.',
  locationLabel: 'Near you',
  defaultCity: 'Köln',
} as const;

/**
 * Recurring V1 component dimensions from mockup analysis.
 * Values marked REVIEW in DESIGN_GUIDELINES.md where uncertain.
 */
export const componentSize = {
  headerContentHeight: 48,
  searchFieldHeight: 40,
  searchScreenFieldHeight: 48,
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
  /** Mockup 09–14 discovery list cards use a square thumbnail. */
  discoveryListThumbnailAspectRatio: 1,
  /** Mockup 09 compact "Heute Abend" list thumbnail. */
  discoveryCompactThumbnailSize: 64,
  /** Home golden screen — larger tonight thumbnail for consumer list rows. */
  homeTonightThumbnailSize: 72,
  /** Mockups 15 and 38 public-profile avatar diameter. */
  profileAvatarSize: 76,
  /** Mockup 54 organizer-card logo diameter. */
  organizerLogoSize: 60,
  /** Mockup 39 team-member avatar diameter. */
  teamMemberAvatarSize: 42,
  /** Mockup 39 team-member row minimum height. */
  teamMemberRowMinHeight: 56,
  /** Mockup 16 ticket-list event image widths. */
  ticketCardImageWidth: 148,
  ticketCardMinHeight: 168,
  ticketCardCompactImageWidth: 84,
  /** Mockup 17 ticket-detail QR placeholder size. */
  ticketQrCodeSize: 152,
  eventListRowMinHeight: 96,
  featuredHeroAspectRatio: 16 / 9,
  /** Home featured hero — tall portrait image dominates the card. */
  featuredHomeAspectRatio: 3 / 4,
  /** Vertical premium discovery card — image-first emotional layout. */
  verticalPremiumAspectRatio: 4 / 5,
  /** Compact premium tonight card thumbnail. */
  compactPremiumThumbnailSize: 80,
  /** Home Top Clubs — compact image-forward venue rail, below event-card dominance. */
  venueSpotlightAspectRatio: 4 / 5,
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
