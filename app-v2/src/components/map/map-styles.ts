import type { BadgeStatus } from '@/components/feedback/badge-styles';
import type { Theme } from '@/design/theme';

import type { MapPinStatus } from './view-models';

export interface ResolvedMapPinStyle {
  backgroundColor: string;
  borderColor: string;
  labelColor: string;
  badgeStatus: BadgeStatus;
}

/** Pure display resolver. It never performs clustering or coordinate logic. */
export function resolveMapPinStyle(theme: Theme, status: MapPinStatus): ResolvedMapPinStyle {
  switch (status) {
    case 'selected':
      return { backgroundColor: theme.colors.accent, borderColor: theme.colors.textOnAccent, labelColor: theme.colors.textOnAccent, badgeStatus: 'info' };
    case 'today':
      return { backgroundColor: theme.colors.successMuted, borderColor: theme.colors.success, labelColor: theme.colors.success, badgeStatus: 'success' };
    case 'sold_out':
    case 'cancelled':
      return { backgroundColor: theme.colors.destructiveMuted, borderColor: theme.colors.destructive, labelColor: theme.colors.destructive, badgeStatus: 'error' };
    case 'default':
    default:
      return { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.accent, labelColor: theme.colors.accent, badgeStatus: 'default' };
  }
}
