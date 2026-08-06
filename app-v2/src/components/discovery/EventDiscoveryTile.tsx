import { memo, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { Badge } from '@/components/feedback/Badge';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { resolveEventStatus, resolveTicketStatus } from '@/components/discovery/event-status-styles';
import type { EventDiscoveryTileViewModel, EventStatus, EventTicketStatus } from '@/components/discovery/view-models';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import {
  discoveryTileMetrics,
  type DiscoveryTileVariant,
} from './discovery-tile-styles';

export interface EventDiscoveryTileProps {
  event: EventDiscoveryTileViewModel;
  variant?: DiscoveryTileVariant;
  saved?: boolean;
  onPress?: () => void;
  onFavoritePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function resolveOverlayBadge(
  primaryStatus?: EventStatus,
  ticketStatus?: EventTicketStatus,
): { label: string; status: 'default' | 'success' | 'warning' | 'error' | 'info' } | undefined {
  if (primaryStatus) {
    const resolved = resolveEventStatus(primaryStatus);
    return { label: resolved.label, status: resolved.badgeStatus };
  }

  if (ticketStatus === 'limited') {
    const resolved = resolveTicketStatus('limited');
    return { label: resolved.label, status: resolved.badgeStatus };
  }

  if (ticketStatus === 'free') {
    const resolved = resolveTicketStatus('free');
    return { label: resolved.label, status: resolved.badgeStatus };
  }

  return undefined;
}

export const EventDiscoveryTile = memo(function EventDiscoveryTile({
  event,
  variant = 'standard',
  saved = false,
  onPress,
  onFavoritePress,
  style,
  testID,
}: EventDiscoveryTileProps) {
  const { theme } = useTheme();
  const [imageError, setImageError] = useState(false);
  const badge = useMemo(
    () => resolveOverlayBadge(event.status, event.ticketStatus),
    [event.status, event.ticketStatus],
  );
  const showMeta = variant !== 'standard';
  const aspectRatio =
    variant === 'wide'
      ? discoveryTileMetrics.wideAspectRatio
      : variant === 'tall'
        ? discoveryTileMetrics.tallAspectRatio
        : discoveryTileMetrics.standardAspectRatio;

  const frame = (
    <View style={[styles.frame, { aspectRatio, backgroundColor: theme.colors.surfaceElevated }]}>
      {event.image && !imageError ? (
        <Image
          source={event.image}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: theme.colors.surfaceSubtle }]}>
          <AppIcon name="image-outline" size="md" colorRole="muted" />
        </View>
      )}

      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.overlayTop} pointerEvents="none">
        <View style={[styles.datePill, { backgroundColor: theme.colors.overlay }]}>
          <AppText role="badge" color={theme.colors.textOnPrimary}>
            {event.dateLabel}
          </AppText>
        </View>
        {badge ? (
          <Badge label={badge.label} status={badge.status} style={styles.statusBadge} />
        ) : null}
      </View>

      {showMeta ? (
        <View style={styles.overlayBottom} pointerEvents="none">
          <AppText role="cardTitle" color={theme.colors.textOnPrimary} numberOfLines={2}>
            {event.title}
          </AppText>
          <AppText role="caption" color={theme.colors.textOnPrimary} numberOfLines={1}>
            {event.venueLabel} · {event.cityLabel}
          </AppText>
          {event.timeLabel ? (
            <AppText role="caption" color={theme.colors.textOnPrimary}>
              {event.timeLabel}
            </AppText>
          ) : null}
          {event.ticketLabel ? (
            <AppText role="caption" color={theme.colors.textOnPrimary}>
              {event.ticketLabel}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const favoriteAction = onFavoritePress ? (
    <View style={styles.favoriteWrap} pointerEvents="box-none">
      <FavoriteButton
        active={saved}
        onPress={onFavoritePress}
        accessibilityLabel={saved ? 'Aus Gespeichert entfernen' : 'Event speichern'}
      />
    </View>
  ) : null;

  if (!onPress) {
    return (
      <View style={style} testID={testID ?? `discovery-tile-${event.id}`}>
        {frame}
        {favoriteAction}
      </View>
    );
  }

  return (
    <InteractiveCard
      onPress={onPress}
      accessibilityLabel={event.accessibilityLabel}
      actions={favoriteAction}
      style={style}
      pressableStyle={styles.pressable}
      pressedStyle={styles.pressed}
      testID={testID ?? `discovery-tile-${event.id}`}
    >
      {frame}
    </InteractiveCard>
  );
});

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  pressed: {
    opacity: 0.92,
  },
  frame: {
    overflow: 'hidden',
    borderRadius: 8,
    position: 'relative',
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: discoveryTileMetrics.scrimHeight,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlayTop: {
    position: 'absolute',
    top: discoveryTileMetrics.overlayPadding,
    left: discoveryTileMetrics.overlayPadding,
    right: discoveryTileMetrics.overlayPadding,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  datePill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadge: {
    maxWidth: '58%',
  },
  favoriteWrap: {
    position: 'absolute',
    right: discoveryTileMetrics.overlayPadding,
    bottom: discoveryTileMetrics.overlayPadding,
  },
  overlayBottom: {
    position: 'absolute',
    left: discoveryTileMetrics.overlayPadding,
    right: discoveryTileMetrics.overlayPadding,
    bottom: discoveryTileMetrics.overlayPadding,
    gap: 2,
  },
});
