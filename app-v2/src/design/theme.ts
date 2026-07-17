import { colors, colorRoles, opacity } from './colors';
import { appConfig, componentSize, layout, v1Components } from './layout';
import { borderWidth, radii, radiusRoles } from './radii';
import { shadows } from './shadows';
import { spacing, spacingRoles } from './spacing';
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textRoles,
  textVariants,
} from './typography';

export const theme = {
  colors,
  colorRoles,
  opacity,
  spacing,
  spacingRoles,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
  textVariants,
  textRoles,
  radii,
  radiusRoles,
  borderWidth,
  shadows,
  layout,
  componentSize,
  v1Components,
  appConfig,
} as const;

export type Theme = typeof theme;

export {
  colors,
  colorRoles,
  opacity,
  spacing,
  spacingRoles,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
  textVariants,
  textRoles,
  radii,
  radiusRoles,
  borderWidth,
  shadows,
  layout,
  componentSize,
  v1Components,
  appConfig,
};
