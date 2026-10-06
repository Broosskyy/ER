import type { ThemeColors } from '@/design/theme/types';
import { radiusRoles, borderWidth } from '@/design/radii';
import { spacing } from '@/design/spacing';

export type BannerVariant = 'info' | 'success' | 'warning' | 'error';

export interface ResolvedBannerStyle {
  backgroundColor: string;
  borderColor: string;
  titleColor: string;
  messageColor: string;
  iconColor: string;
}

export function resolveBannerStyle(
  colors: ThemeColors,
  variant: BannerVariant,
): ResolvedBannerStyle {
  switch (variant) {
    case 'success':
      return {
        backgroundColor: colors.successMuted,
        borderColor: colors.success,
        titleColor: colors.success,
        messageColor: colors.textPrimary,
        iconColor: colors.success,
      };
    case 'warning':
      return {
        backgroundColor: colors.warningMuted,
        borderColor: colors.warning,
        titleColor: colors.warning,
        messageColor: colors.textPrimary,
        iconColor: colors.warning,
      };
    case 'error':
      return {
        backgroundColor: colors.destructiveMuted,
        borderColor: colors.destructive,
        titleColor: colors.destructive,
        messageColor: colors.textPrimary,
        iconColor: colors.destructive,
      };
    case 'info':
    default:
      return {
        backgroundColor: colors.accentMuted,
        borderColor: colors.info,
        titleColor: colors.info,
        messageColor: colors.textPrimary,
        iconColor: colors.info,
      };
  }
}

export const bannerMetrics = {
  borderRadius: radiusRoles.badge,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
  borderWidth: borderWidth.hairline,
  gap: spacing.sm,
} as const;
