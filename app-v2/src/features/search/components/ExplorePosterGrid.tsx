import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { EventDisplayModel } from '@/features/events';
import { getContentMaxWidth, useResponsiveLayout } from '@/platform/responsive';

const POSTER_ASPECT_RATIO = 3 / 4;
const GRID_GAP = spacing.sm;

export interface ExplorePosterCardProps {
  event: EventDisplayModel;
  width: number;
}

export function ExplorePosterCard({ event, width }: ExplorePosterCardProps) {
  const router = useRouter();
  const height = width / POSTER_ASPECT_RATIO;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${event.title}`}
      onPress={() => router.push(`/event/${event.id}`)}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <Image source={event.image} style={[styles.image, { width, height }]} resizeMode="cover" />
      <View style={styles.overlay}>
        <AppText style={styles.date}>{event.date}</AppText>
        <AppText style={styles.title} numberOfLines={2}>
          {event.title}
        </AppText>
        <AppText style={styles.venue} numberOfLines={1}>
          {event.venue}
        </AppText>
      </View>
    </Pressable>
  );
}

export interface ExplorePosterGridProps {
  events: EventDisplayModel[];
}

export function ExplorePosterGrid({ events }: ExplorePosterGridProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { exploreGridColumns } = useResponsiveLayout();
  const contentMaxWidth = getContentMaxWidth(screenWidth) ?? screenWidth;
  const gridWidth = Math.min(screenWidth, contentMaxWidth);
  const horizontalPadding = spacing.md * 2;
  const cardWidth =
    (gridWidth - horizontalPadding - GRID_GAP * (exploreGridColumns - 1)) / exploreGridColumns;

  return (
    <View style={[styles.grid, { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
      {events.map((event) => (
        <ExplorePosterCard key={event.id} event={event} width={cardWidth} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: spacing.md,
  },
  card: {
    borderRadius: radiusRoles.eventThumbnail,
    overflow: 'hidden',
    backgroundColor: colorRoles.cardBackground,
    borderWidth: 1,
    borderColor: colorRoles.cardBorder,
  },
  pressed: {
    opacity: 0.92,
  },
  image: {
    backgroundColor: colors.surfaceElevated,
  },
  overlay: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  date: {
    ...textRoles.badge,
    color: colors.primary,
    fontWeight: '700',
  },
  title: {
    ...textRoles.cardTitle,
    fontSize: 14,
  },
  venue: {
    ...textRoles.cardSubtitle,
    fontSize: 12,
  },
});
