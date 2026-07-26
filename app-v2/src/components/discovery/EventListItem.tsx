import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/spacing';

import { EventImage } from './EventImage';
import { EventStatusBadge } from './EventStatusBadge';
import type { EventListItemViewModel } from './view-models';

export interface EventListItemProps {
  event: EventListItemViewModel;
  saved?: boolean;
  onPress?: () => void;
  onFavoritePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Compact discovery list item for search results, saved events, and selections. */
export function EventListItem({
  event,
  saved = false,
  onPress,
  onFavoritePress,
  style,
  testID,
}: EventListItemProps) {
  const { theme } = useTheme();
  const content = (
    <View style={[styles.row, style]}>
      <EventImage source={event.image} variant="compact" />
      <View style={styles.details}>
        <View style={styles.topMeta}>
          <AppText role="caption" color={theme.colors.accent} numberOfLines={1}>
            {(event.genreLabels?.[0] ?? '').toUpperCase()}
          </AppText>
          {event.timeLabel ? <AppText role="metadata">{event.timeLabel}</AppText> : null}
        </View>
        <AppText role="cardTitle" numberOfLines={1}>
          {event.title}
        </AppText>
        <View style={styles.venueRow}>
          <AppIcon name="location" size="sm" colorRole="accent" />
          <AppText role="cardSubtitle" numberOfLines={1}>
            {event.venueLabel}, {event.cityLabel}
          </AppText>
        </View>
        <View style={styles.bottomRow}>
          <AppText role="metadata">{event.dateLabel}</AppText>
          {event.status ? <EventStatusBadge status={event.status} /> : null}
        </View>
      </View>
    </View>
  );

  const favoriteAction = onFavoritePress ? (
    <FavoriteButton
      active={saved}
      onPress={onFavoritePress}
      accessibilityLabel={saved ? 'Remove from saved events' : 'Save event'}
    />
  ) : null;

  if (!onPress) {
    return <View testID={testID} style={styles.container}>{content}{favoriteAction}</View>;
  }

  return (
    <InteractiveCard
      testID={testID}
      onPress={onPress}
      accessibilityLabel={event.accessibilityLabel}
      actions={favoriteAction}
      actionsPlacement="trailing"
      pressableStyle={styles.pressable}
      pressedStyle={styles.pressed}
    >
      {content}
    </InteractiveCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressable: {
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  topMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.88,
  },
});
