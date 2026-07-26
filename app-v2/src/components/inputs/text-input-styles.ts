import { opacity } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { borderWidth } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import type { Theme } from '@/design/theme/types';

export type InputVisualState =
  | 'default'
  | 'focus'
  | 'error'
  | 'success'
  | 'disabled'
  | 'readonly';

export interface TextInputStyleInput {
  focused: boolean;
  disabled: boolean;
  readOnly?: boolean;
  error?: boolean;
  success?: boolean;
}

export interface ResolvedTextInputStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  placeholderColor: string;
  helperColor: string;
  opacity: number;
  visualState: InputVisualState;
}

export function resolveTextInputStyle(
  theme: Theme,
  { focused, disabled, readOnly, error, success }: TextInputStyleInput,
): ResolvedTextInputStyle {
  const { colors, colorRoles } = theme;

  if (disabled) {
    return {
      backgroundColor: colorRoles.searchBackground,
      borderColor: colorRoles.searchBorder,
      textColor: colors.textMuted,
      placeholderColor: colorRoles.searchPlaceholder,
      helperColor: colors.textMuted,
      opacity: opacity.disabled,
      visualState: 'disabled',
    };
  }

  if (readOnly) {
    return {
      backgroundColor: colorRoles.searchBackground,
      borderColor: colorRoles.searchBorder,
      textColor: colorRoles.searchText,
      placeholderColor: colorRoles.searchPlaceholder,
      helperColor: colors.textSecondary,
      opacity: 1,
      visualState: 'readonly',
    };
  }

  if (error) {
    return {
      backgroundColor: colorRoles.searchBackground,
      borderColor: colors.destructive,
      textColor: colorRoles.searchText,
      placeholderColor: colorRoles.searchPlaceholder,
      helperColor: colors.destructive,
      opacity: 1,
      visualState: 'error',
    };
  }

  if (success) {
    return {
      backgroundColor: colorRoles.searchBackground,
      borderColor: colors.success,
      textColor: colorRoles.searchText,
      placeholderColor: colorRoles.searchPlaceholder,
      helperColor: colors.success,
      opacity: 1,
      visualState: 'success',
    };
  }

  if (focused) {
    return {
      backgroundColor: colorRoles.searchBackground,
      borderColor: colors.accent,
      textColor: colorRoles.searchText,
      placeholderColor: colorRoles.searchPlaceholder,
      helperColor: colors.textSecondary,
      opacity: 1,
      visualState: 'focus',
    };
  }

  return {
    backgroundColor: colorRoles.searchBackground,
    borderColor: colorRoles.searchBorder,
    textColor: colorRoles.searchText,
    placeholderColor: colorRoles.searchPlaceholder,
    helperColor: colors.textSecondary,
    opacity: 1,
    visualState: 'default',
  };
}

export const textInputMetrics = {
  minHeight: componentSize.searchScreenFieldHeight,
  multilineMinHeight: componentSize.buttonHeight * 2,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderWidth: borderWidth.hairline,
  gap: spacing.xs,
} as const;

export const searchFieldMetrics = {
  height: componentSize.searchFieldHeight,
  paddingHorizontal: spacingRoles.searchPaddingHorizontal,
} as const;

export const searchBarMetrics = {
  height: componentSize.searchScreenFieldHeight,
  paddingHorizontal: spacingRoles.searchPaddingHorizontal,
} as const;
