import type { ThemeColors } from '@/design/theme/types';
import { radiusRoles, borderWidth } from '@/design/radii';
import { spacing } from '@/design/spacing';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ResolvedToastStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
}

export function resolveToastStyle(
  colors: ThemeColors,
  variant: ToastVariant,
): ResolvedToastStyle {
  switch (variant) {
    case 'success':
      return {
        backgroundColor: colors.successMuted,
        borderColor: colors.success,
        textColor: colors.success,
        iconColor: colors.success,
      };
    case 'warning':
      return {
        backgroundColor: colors.warningMuted,
        borderColor: colors.warning,
        textColor: colors.warning,
        iconColor: colors.warning,
      };
    case 'error':
      return {
        backgroundColor: colors.destructiveMuted,
        borderColor: colors.destructive,
        textColor: colors.destructive,
        iconColor: colors.destructive,
      };
    case 'info':
    default:
      return {
        backgroundColor: colors.accentMuted,
        borderColor: colors.info,
        textColor: colors.info,
        iconColor: colors.info,
      };
  }
}

export const toastMetrics = {
  borderRadius: radiusRoles.button,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
  borderWidth: borderWidth.hairline,
  gap: spacing.sm,
  defaultDurationMs: 4000,
} as const;
