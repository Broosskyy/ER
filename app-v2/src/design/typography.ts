import { TextStyle } from 'react-native';

import { colors } from './colors';

/**
 * Eternal Rave typography scale.
 * Source: reference/old-code/src/constants/theme.ts (Typography)
 */
export const fontSize = {
  caption: 11,
  xs: 12,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 30,
} as const;

export type FontSizeToken = keyof typeof fontSize;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

/** Base text variants — unchanged from bootstrap */
export const textVariants = {
  display: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: fontSize.display * lineHeight.tight,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: fontSize.xxl * lineHeight.tight,
  },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: fontSize.xl * lineHeight.tight,
  },
  body: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    color: colors.textPrimary,
    lineHeight: fontSize.md * lineHeight.normal,
  },
  bodySmall: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    color: colors.textPrimary,
    lineHeight: fontSize.base * lineHeight.normal,
  },
  caption: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
} as const satisfies Record<string, TextStyle>;

/**
 * V1 semantic typography roles derived from mockup hierarchy.
 * Visible on 09_Home, 10_Events, 11_Event_Details, 15_Profile.
 */
export const textRoles = {
  screenTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: fontSize.xxl * lineHeight.tight,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: fontSize.xl * lineHeight.tight,
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: fontSize.md * lineHeight.tight,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  body: textVariants.body,
  metadata: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    color: colors.textMuted,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  label: textVariants.label,
  button: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textOnPrimary,
    lineHeight: fontSize.md * lineHeight.tight,
  },
  chip: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    lineHeight: fontSize.base * lineHeight.tight,
  },
  chipSelected: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    lineHeight: fontSize.base * lineHeight.tight,
  },
  navLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    lineHeight: fontSize.xs * lineHeight.tight,
  },
  navLabelActive: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    lineHeight: fontSize.xs * lineHeight.tight,
  },
  searchInput: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    color: colors.textPrimary,
    lineHeight: fontSize.base * lineHeight.normal,
  },
  searchPlaceholder: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
    lineHeight: fontSize.base * lineHeight.normal,
  },
  badge: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    lineHeight: fontSize.caption * lineHeight.normal,
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
export type TextRole = keyof typeof textRoles;

/**
 * REVIEW REQUIRED: Font family not legible from compressed mockups.
 * Mockup 63 + MOCKUP-SCREENS.md specify "clean sans-serif".
 * Use system default until validated during Home screen implementation.
 */
export const fontFamily = {
  primary: undefined,
} as const;
