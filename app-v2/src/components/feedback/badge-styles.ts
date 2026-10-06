import type { ThemeColors } from '@/design/theme/types';
import { spacing } from '@/design/spacing';
import { radiusRoles } from '@/design/radii';

export type BadgeStatus = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface ResolvedBadgeStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

export function resolveBadgeStyle(
  colors: ThemeColors,
  status: BadgeStatus,
): ResolvedBadgeStyle {
  switch (status) {
    case 'success':
      return {
        backgroundColor: colors.successMuted,
        borderColor: colors.success,
        textColor: colors.success,
      };
    case 'warning':
      return {
        backgroundColor: colors.warningMuted,
        borderColor: colors.warning,
        textColor: colors.warning,
      };
    case 'error':
      return {
        backgroundColor: colors.destructiveMuted,
        borderColor: colors.destructive,
        textColor: colors.destructive,
      };
    case 'info':
      return {
        backgroundColor: colors.accentMuted,
        borderColor: colors.info,
        textColor: colors.info,
      };
    case 'default':
    default:
      return {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.borderSubtle,
        textColor: colors.textSecondary,
      };
  }
}

export const badgeMetrics = {
  borderRadius: radiusRoles.badge,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
} as const;
