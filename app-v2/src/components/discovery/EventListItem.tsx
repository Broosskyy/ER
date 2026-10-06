import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { componentSize } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { EventImage } from './EventImage';
import { TicketPriceLabel } from './TicketPriceLabel';
import type { EventListItemViewModel } from './view-models';

export type EventListItemDensity = 'default' | 'relaxed';

export interface EventListItemProps {
  event: EventListItemViewModel;
  saved?: boolean;
  density?: EventListItemDensity;
  onPress?: () => void;
  onFavoritePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Compact discovery list item with fixed thumbnail, text, time, and favorite zones. */
export function EventListItem({
  event,
  saved = false,
  density = 'default',
  onPress,
  onFavoritePress,
  style,
  testID,
}: EventListItemProps) {
  const { theme } = useTheme();
  const isRelaxed = density === 'relaxed';
  const thumbnailSize = isRelaxed
    ? componentSize.homeTonightThumbnailSize
    : componentSize.discoveryCompactThumbnailSize;

  const thumbnail = (
    <EventImage
      source={event.image}
      variant="compact"
      style={{ width: thumbnailSize, height: thumbnailSize }}
      overlay={
        <View
          style={[
            styles.dateBadge,
            {
              backgroundColor: theme.colors.overlay,
              borderRadius: theme.radiusRoles.badge,
            },
          ]}
        >
          <AppText role="caption" color={theme.colors.textOnPrimary}>
            {event.dateLabel}
          </AppText>
        </View>
      }
    />
  );

  const textZone = (
    <View style={styles.details}>
      <AppText role="cardTitle" numberOfLines={1}>
        {event.title}
      </AppText>
      <View style={styles.venueRow}>
        <AppIcon name="location" size="sm" colorRole="accent" />
        <AppText role="cardSubtitle" color={theme.colors.textSecondary} numberOfLines={1}>
          {event.venueLabel}, {event.cityLabel}
        </AppText>
      </View>
      {event.genreLabels && event.genreLabels.length > 0 ? (
        <View style={styles.genreRow}>
          {event.genreLabels.slice(0, 2).map((genre) => (
            <View
              key={genre}
              style={[
                styles.genreTag,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderRadius: theme.radiusRoles.badge,
                },
              ]}
            >
              <AppText role="badge" color={theme.colors.accent}>
                {genre}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {event.ticketLabel ? (
        <TicketPriceLabel label={event.ticketLabel} colorToken={event.ticketColorToken} />
      ) : null}
    </View>
  );

  const timeZone = event.timeLabel ? (
    <View style={styles.timeColumn}>
      <AppText role="metadata" color={theme.colors.textSecondary}>
        {event.timeLabel}
      </AppText>
    </View>
  ) : null;

  const content = (
    <View style={[styles.row, isRelaxed && styles.rowRelaxed, style]}>
      {thumbnail}
      {textZone}
      {timeZone}
    </View>
  );

  const favoriteAction = onFavoritePress ? (
    <View style={styles.favoriteColumn}>
      <FavoriteButton
        active={saved}
        onPress={onFavoritePress}
        accessibilityLabel={saved ? 'Remove from saved events' : 'Save event'}
      />
    </View>
  ) : null;

  if (!onPress) {
    return (
      <View testID={testID} style={styles.container}>
        {content}
        {favoriteAction}
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.container}>
      <InteractiveCard
        onPress={onPress}
        accessibilityLabel={event.accessibilityLabel}
        pressableStyle={styles.pressable}
        pressedStyle={styles.pressed}
        style={styles.pressableContainer}
      >
        {content}
      </InteractiveCard>
      {favoriteAction}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  pressableContainer: {
    flex: 1,
    minWidth: 0,
  },
  pressable: {
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 0,
  },
  rowRelaxed: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  timeColumn: {
    flexShrink: 0,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: spacing.xs,
  },
  favoriteColumn: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  genreTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.88,
  },
});
