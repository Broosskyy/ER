import type { Theme } from '@/design/theme/types';
import { borderWidth } from '@/design/radii';

export type SurfaceVariant = 'default' | 'subtle' | 'elevated' | 'transparent';

export interface ResolvedSurfaceStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}

export function resolveSurfaceStyle(
  theme: Theme,
  variant: SurfaceVariant,
): ResolvedSurfaceStyle {
  const { colors } = theme;

  switch (variant) {
    case 'subtle':
      return {
        backgroundColor: colors.surfaceSubtle,
        borderColor: colors.borderSubtle,
        borderWidth: borderWidth.hairline,
      };
    case 'elevated':
      return {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.borderSubtle,
        borderWidth: borderWidth.hairline,
      };
    case 'transparent':
      return {
        backgroundColor: colors.transparent,
        borderColor: colors.transparent,
        borderWidth: 0,
      };
    case 'default':
    default:
      return {
        backgroundColor: colors.surface,
        borderColor: colors.borderSubtle,
        borderWidth: borderWidth.hairline,
      };
  }
}
