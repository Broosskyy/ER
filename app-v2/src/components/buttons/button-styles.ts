import { opacity } from '@/design/colors';
import { componentSize, layout } from '@/design/layout';
import { spacing } from '@/design/spacing';
import type { Theme } from '@/design/theme/types';

import type { AppIconSize } from '@/components/primitives/icon-sizes';
import { iconSizes } from '@/components/primitives/icon-sizes';

export type FilledButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type IconButtonSize = AppIconSize;

export interface ButtonStyleInput {
  variant: FilledButtonVariant;
  pressed: boolean;
  hovered: boolean;
  disabled: boolean;
}

export interface ResolvedFilledButtonStyle {
  backgroundColor: string;
  borderColor: string;
  labelColor: string;
  opacity: number;
}

export function resolveFilledButtonStyle(
  theme: Theme,
  { variant, pressed, hovered, disabled }: ButtonStyleInput,
): ResolvedFilledButtonStyle {
  const { colors, colorRoles } = theme;
  const isActive = pressed || hovered;

  if (disabled) {
    if (variant === 'primary') {
      return {
        backgroundColor: colorRoles.buttonPrimaryBackground,
        borderColor: colors.transparent,
        labelColor: colorRoles.buttonPrimaryText,
        opacity: opacity.disabled,
      };
    }

    if (variant === 'destructive') {
      return {
        backgroundColor: colors.transparent,
        borderColor: colors.destructive,
        labelColor: colors.destructive,
        opacity: opacity.disabled,
      };
    }

    if (variant === 'ghost') {
      return {
        backgroundColor: colors.transparent,
        borderColor: colors.transparent,
        labelColor: colors.textSecondary,
        opacity: opacity.disabled,
      };
    }

    return {
      backgroundColor: colorRoles.buttonSecondaryBackground,
      borderColor: colorRoles.buttonSecondaryBorder,
      labelColor: colorRoles.buttonSecondaryText,
      opacity: opacity.disabled,
    };
  }

  if (variant === 'primary') {
    return {
      backgroundColor: isActive
        ? colorRoles.buttonPrimaryPressed
        : colorRoles.buttonPrimaryBackground,
      borderColor: colors.transparent,
      labelColor: colorRoles.buttonPrimaryText,
      opacity: 1,
    };
  }

  if (variant === 'destructive') {
    return {
      backgroundColor: isActive ? colors.destructiveMuted : colors.transparent,
      borderColor: colors.destructive,
      labelColor: colors.destructive,
      opacity: 1,
    };
  }

  if (variant === 'ghost') {
    return {
      backgroundColor: isActive ? colors.accentMuted : colors.transparent,
      borderColor: colors.transparent,
      labelColor: isActive ? colors.accentPressed : colors.accent,
      opacity: 1,
    };
  }

  return {
    backgroundColor: isActive ? colors.surfaceSubtle : colorRoles.buttonSecondaryBackground,
    borderColor: isActive ? colors.accent : colorRoles.buttonSecondaryBorder,
    labelColor: colorRoles.buttonSecondaryText,
    opacity: 1,
  };
}

export interface IconButtonStyleInput {
  pressed: boolean;
  disabled: boolean;
  destructive?: boolean;
}

export interface ResolvedIconButtonStyle {
  backgroundColor: string;
  iconColor: string;
  opacity: number;
}

export function resolveIconButtonStyle(
  theme: Theme,
  { pressed, disabled, destructive }: IconButtonStyleInput,
): ResolvedIconButtonStyle {
  const { colors } = theme;

  if (disabled) {
    return {
      backgroundColor: colors.surface,
      iconColor: destructive ? colors.destructive : colors.textPrimary,
      opacity: opacity.disabled,
    };
  }

  return {
    backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
    iconColor: destructive ? colors.destructive : colors.textPrimary,
    opacity: 1,
  };
}

export function resolveIconButtonDimensions(size: IconButtonSize = 'md') {
  const iconSize = iconSizes[size];
  const buttonSize = Math.max(layout.minTouchTarget, iconSize + spacing.md);

  return {
    buttonSize,
    iconSize,
  };
}

export const filledButtonMetrics = {
  minHeight: layout.minTouchTarget,
  height: componentSize.buttonHeight,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
} as const;

export const iconButtonMetrics = {
  size: componentSize.iconButtonSize,
  iconSize: componentSize.iconMd,
} as const;
