import type { ThemeColors } from '@/design/theme/types';
import { radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';

export type SkeletonShape = 'text' | 'rectangle' | 'rect' | 'circle' | 'card' | 'thumbnail';

export interface ResolvedSkeletonStyle {
  backgroundColor: string;
  highlightColor: string;
}

export function resolveSkeletonStyle(colors: ThemeColors): ResolvedSkeletonStyle {
  return {
    backgroundColor: colors.skeletonBase,
    highlightColor: colors.skeletonHighlight,
  };
}

export const skeletonMetrics = {
  textHeight: spacing.md,
  textRadius: radiusRoles.badge,
  circleSize: spacing.xxl,
  rectHeight: spacing.xxl,
  rectRadius: radiusRoles.badge,
  cardHeight: spacing.xxl * 2,
  cardRadius: radiusRoles.card,
  thumbnailWidth: spacing.xxl * 4,
  thumbnailHeight: spacing.xxl * 3,
  thumbnailRadius: radiusRoles.card,
  gap: spacing.sm,
} as const;
