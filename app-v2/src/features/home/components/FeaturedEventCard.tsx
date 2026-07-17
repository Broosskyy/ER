import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radii, radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { DemoEvent } from '@/features/events/data/demo-events';

export interface FeaturedEventCardProps {
  event: DemoEvent;
  width: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function FeaturedEventCard({
  event,
  width,
  isFavorite,
  onToggleFavorite,
}: FeaturedEventCardProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/event/${event.id}`)}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image source={event.image} style={styles.image} resizeMode="cover" />
        <View style={styles.imageOverlay} />
        <View style={styles.dateBadge}>
          <AppText style={styles.dateBadgeText}>{event.dateLabel}</AppText>
        </View>
        <View style={styles.favoriteWrap} onStartShouldSetResponder={() => true}>
          <FavoriteButton active={isFavorite} onPress={onToggleFavorite} />
        </View>
        <View style={styles.metaOverlay}>
          <AppText style={styles.category}>{event.genres[0]?.toUpperCase()}</AppText>
          <AppText style={styles.title} numberOfLines={2}>
            {event.title}
          </AppText>
          <View style={styles.venueRow}>
            <Ionicons name="location" size={componentSize.iconSm} color={colors.primary} />
            <AppText style={styles.venue} numberOfLines={1}>
              {event.venueName}, {event.city}
            </AppText>
          </View>
          <View style={styles.tagRow}>
            {event.genres.slice(0, 2).map((genre) => (
              <View key={genre} style={styles.tag}>
                <AppText style={styles.tagText}>{genre}</AppText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusRoles.card,
    overflow: 'hidden',
    backgroundColor: colorRoles.cardBackground,
    borderWidth: 1,
    borderColor: colorRoles.cardBorder,
  },
  pressed: {
    opacity: 0.94,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: componentSize.featuredHeroAspectRatio,
    backgroundColor: colors.surfaceElevated,
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 11, 15, 0.28)',
  },
  dateBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dateBadgeText: {
    ...textRoles.badge,
    color: colors.background,
    fontWeight: '700',
  },
  favoriteWrap: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  metaOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: 'rgba(11, 11, 15, 0.62)',
  },
  category: {
    ...textRoles.badge,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    ...textRoles.cardTitle,
    fontSize: 18,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  venue: {
    ...textRoles.cardSubtitle,
    flex: 1,
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
});
