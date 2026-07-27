import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { IconButton } from '@/components/buttons/IconButton';
import { EventCard } from '@/components/discovery/EventCard';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { SavedEventViewModel } from './view-models';

export interface SavedEventCardProps {
  event: SavedEventViewModel;
  onPress?: () => void;
  onFavoritePress?: () => void;
  onMorePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Mockup 14 saved event row — extends EventCard with saved timestamp and more action.
 * Uses flat sibling actions via InteractiveCard.
 */
export function SavedEventCard({
  event,
  onPress,
  onFavoritePress,
  onMorePress,
  style,
  testID,
}: SavedEventCardProps) {
  const { theme } = useTheme();
  const saved = event.savedState !== 'removed';

  const actions = (
    <View style={styles.actions}>
      {onFavoritePress ? (
        <FavoriteButton
          active={saved}
          onPress={onFavoritePress}
          accessibilityLabel={saved ? 'Aus Gespeichert entfernen' : 'Event speichern'}
        />
      ) : null}
      {onMorePress ? (
        <IconButton icon="ellipsis-vertical" accessibilityLabel="Weitere Aktionen" onPress={onMorePress} />
      ) : null}
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {event.collectionLabel ? (
        <AppText role="caption" color={theme.colors.accent}>
          {event.collectionLabel}
        </AppText>
      ) : null}
      {event.savedAtLabel ? (
        <AppText role="caption" color={theme.colors.textSecondary}>
          {event.savedAtLabel}
        </AppText>
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View style={style} testID={testID}>
        <EventCard event={event} saved={saved} />
        {footer}
      </View>
    );
  }

  return (
    <InteractiveCard
      testID={testID}
      onPress={onPress}
      accessibilityLabel={event.accessibilityLabel}
      actions={actions}
      actionsPlacement="trailing"
      style={style}
    >
      <EventCard event={event} saved={saved} />
      {footer}
    </InteractiveCard>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  footer: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
