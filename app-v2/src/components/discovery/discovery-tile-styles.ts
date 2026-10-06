import { spacing } from '@/design/spacing';

export type DiscoveryTileVariant = 'standard' | 'wide' | 'tall';

export const DISCOVERY_GRID_GAP = spacing.xs;

export const discoveryTileMetrics = {
  standardAspectRatio: 1,
  wideAspectRatio: 2.1,
  tallAspectRatio: 0.72,
  overlayPadding: spacing.xs,
  scrimHeight: 56,
} as const;
