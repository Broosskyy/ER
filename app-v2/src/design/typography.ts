import { TextStyle } from 'react-native';

import { colors } from './colors';

/**
 * Eternal Rave typography scale.
 * Source: reference/old-code/src/constants/theme.ts (Typography)
 */
export const fontSize = {
  caption: 10,
  xs: 11,
  sm: 12,
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

export type TextVariant = keyof typeof textVariants;
