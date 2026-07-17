import { colors } from './colors';
import { layout, appConfig } from './layout';
import { radii } from './radii';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { fontSize, fontWeight, lineHeight, textVariants } from './typography';

export const theme = {
  colors,
  spacing,
  fontSize,
  fontWeight,
  lineHeight,
  textVariants,
  radii,
  shadows,
  layout,
  appConfig,
} as const;

export type Theme = typeof theme;

export { colors, spacing, fontSize, fontWeight, lineHeight, textVariants, radii, shadows, layout, appConfig };
