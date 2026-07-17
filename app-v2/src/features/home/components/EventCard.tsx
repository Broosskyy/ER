import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radii, radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { DemoEvent } from '@/features/events/data/demo-events';

export interface EventCardProps {
  event: DemoEvent;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function EventCard({ event, isFavorite, onToggleFavorite }: EventCardProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/event/${event.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.thumbnailWrap}>
        <Image source={event.image} style={styles.thumbnail} resizeMode="cover" />
        <View style={styles.dateOverlay}>
          <AppText style={styles.dateText}>{event.dateLabel}</AppText>
        </View>
      </View>

      <View style={styles.content}>
        <AppText style={styles.title} numberOfLines={2}>
          {event.title}
        </AppText>
        <AppText style={styles.venue} numberOfLines={1}>
          {event.venueName}, {event.city}
        </AppText>
        <View style={styles.tagRow}>
          {event.genres.slice(0, 2).map((genre) => (
            <View key={genre} style={styles.tag}>
              <AppText style={styles.tagText}>{genre}</AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.trailing} onStartShouldSetResponder={() => true}>
        <AppText style={styles.time}>{event.timeLabel}</AppText>
        <FavoriteButton active={isFavorite} onPress={onToggleFavorite} />
      </View>
    </Pressable>
  );
}

const THUMB_WIDTH = componentSize.eventListThumbnailWidth;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingVertical: spacing.md,
    backgroundColor: colorRoles.cardBackground,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colorRoles.cardBorder,
  },
  pressed: {
    opacity: 0.94,
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
    backgroundColor: 'rgba(11, 11, 15, 0.72)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dateText: {
    ...textRoles.badge,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
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
    marginTop: spacing.xs,
  },
  tag: {
    backgroundColor: colorRoles.tagBackground,
    borderRadius: radii.sm,
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
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  time: {
    ...textRoles.metadata,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
