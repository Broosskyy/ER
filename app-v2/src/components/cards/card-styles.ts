import { opacity } from '@/design/colors';
import type { Theme } from '@/design/theme/types';
import { borderWidth } from '@/design/radii';

export interface CardStyleInput {
  elevated: boolean;
  pressed: boolean;
  disabled: boolean;
}

export interface ResolvedCardStyle {
  backgroundColor: string;
  borderColor: string;
  opacity: number;
}

export function resolveCardStyle(
  theme: Theme,
  { elevated, pressed, disabled }: CardStyleInput,
): ResolvedCardStyle {
  const { colors, colorRoles } = theme;

  return {
    backgroundColor: elevated ? colors.surfaceElevated : colorRoles.cardBackground,
    borderColor: colorRoles.cardBorder,
    opacity: disabled ? opacity.disabled : pressed ? opacity.pressed : 1,
  };
}

export const cardMetrics = {
  borderWidth: borderWidth.hairline,
} as const;
