import type { Theme } from '@/design/theme/types';
import { opacity } from '@/design/colors';
import { layout } from '@/design/layout';
import { spacing } from '@/design/spacing';

export type TextButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface TextButtonStyleInput {
  variant: TextButtonVariant;
  pressed: boolean;
  hovered: boolean;
  disabled: boolean;
}

export interface ResolvedTextButtonStyle {
  labelColor: string;
  backgroundColor: string;
  opacity: number;
}

export function resolveTextButtonStyle(
  theme: Theme,
  { variant, pressed, hovered, disabled }: TextButtonStyleInput,
): ResolvedTextButtonStyle {
  const { colors } = theme;

  if (disabled) {
    return {
      labelColor:
        variant === 'primary'
          ? colors.accent
          : variant === 'secondary'
            ? colors.textSecondary
            : colors.accent,
      backgroundColor: colors.transparent,
      opacity: opacity.disabled,
    };
  }

  if (variant === 'primary') {
    return {
      labelColor: pressed || hovered ? colors.accentPressed : colors.accent,
      backgroundColor: colors.transparent,
      opacity: 1,
    };
  }

  if (variant === 'secondary') {
    return {
      labelColor: pressed || hovered ? colors.textPrimary : colors.textSecondary,
      backgroundColor: colors.transparent,
      opacity: 1,
    };
  }

  return {
    labelColor: pressed || hovered ? colors.accentPressed : colors.accent,
    backgroundColor: pressed || hovered ? colors.accentMuted : colors.transparent,
    opacity: 1,
  };
}

export const textButtonMetrics = {
  minHeight: layout.minTouchTarget,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
} as const;
