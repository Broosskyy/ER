import type { Theme } from '@/design/theme/types';
import { layout } from '@/design/layout';
import { borderWidth } from '@/design/radii';
import { spacing } from '@/design/spacing';

export interface ResolvedOverlayStyle {
  scrimColor: string;
  surfaceColor: string;
  borderColor: string;
}

export function resolveOverlayStyle(theme: Theme): ResolvedOverlayStyle {
  return {
    scrimColor: theme.colorRoles.overlayScrim,
    surfaceColor: theme.colors.surface,
    borderColor: theme.colors.borderSubtle,
  };
}

export const overlayMetrics = {
  bottomSheetMaxHeightRatio: 0.92,
  modalMaxWidth: layout.maxContentWidthDesktop * 0.58,
  dialogMaxWidth: layout.maxContentWidthTablet * 0.78,
  padding: spacing.lg,
  gap: spacing.md,
  borderWidth: borderWidth.hairline,
} as const;
