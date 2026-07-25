import { useRouter } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radiusRoles, borderWidth } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { EventDisplayModel } from '@/features/events';

export interface EventCardProps {
  event: EventDisplayModel;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function EventCard({ event, isFavorite, onToggleFavorite }: EventCardProps) {
  const router = useRouter();

  return (
    <InteractiveCard
      accessibilityLabel={event.title}
      onPress={() => router.push(`/event/${event.id}`)}
      style={styles.card}
      pressableStyle={styles.pressable}
      pressedStyle={styles.pressed}
      actionsPlacement="trailing"
      actions={
        <>
          <AppText style={styles.time}>{event.startTime}</AppText>
          <FavoriteButton
            active={isFavorite}
            onPress={onToggleFavorite}
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          />
        </>
      }
      actionsStyle={styles.trailing}
    >
      <View style={styles.thumbnailWrap}>
        <Image source={event.image} style={styles.thumbnail} resizeMode="cover" />
        <View style={styles.dateOverlay}>
          <AppText style={styles.dateText}>{event.date}</AppText>
        </View>
      </View>

      <View style={styles.content}>
        <AppText style={styles.title} numberOfLines={2}>
          {event.title}
        </AppText>
        <AppText style={styles.venue} numberOfLines={1}>
          {event.venue}, {event.city}
        </AppText>
        <View style={styles.tagRow}>
          {event.genres.slice(0, 2).map((genre) => (
            <View key={genre} style={styles.tag}>
              <AppText style={styles.tagText}>{genre}</AppText>
            </View>
          ))}
        </View>
      </View>
    </InteractiveCard>
  );
}

const THUMB_WIDTH = componentSize.eventListThumbnailWidth;

const styles = StyleSheet.create({
  card: {
    minHeight: componentSize.eventListRowMinHeight,
    backgroundColor: colors.background,
    borderTopWidth: borderWidth.hairline,
    borderBottomWidth: borderWidth.hairline,
    borderColor: colorRoles.cardBorder,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingVertical: spacing.lg,
    minHeight: componentSize.eventListRowMinHeight,
  },
  pressed: {
    backgroundColor: colors.surfaceSubtle,
  },
  thumbnailWrap: {
    width: THUMB_WIDTH,
    aspectRatio: componentSize.eventListThumbnailAspectRatio,
    borderRadius: radiusRoles.eventThumbnail,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  dateOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colorRoles.overlayScrim,
    borderRadius: radiusRoles.badge,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dateText: {
    ...textRoles.badge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  title: {
    ...textRoles.cardTitle,
  },
  venue: {
    ...textRoles.cardSubtitle,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colorRoles.tagBackground,
    borderRadius: radiusRoles.badge,
    borderWidth: borderWidth.hairline,
    borderColor: colorRoles.cardBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagText: {
    ...textRoles.badge,
  },
  trailing: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    minHeight: THUMB_WIDTH / componentSize.eventListThumbnailAspectRatio,
    paddingVertical: spacing.lg,
    paddingRight: spacingRoles.screenHorizontal,
    gap: spacing.sm,
  },
  time: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
});
