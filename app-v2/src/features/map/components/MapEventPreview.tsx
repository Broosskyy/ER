import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { DemoEvent, formatEventDateTime } from '@/features/events/data/demo-events';

export interface MapEventPreviewProps {
  event: DemoEvent;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  bottomInset: number;
}

export function MapEventPreview({
  event,
  isFavorite,
  onToggleFavorite,
  onClose,
  bottomInset,
}: MapEventPreviewProps) {
  const router = useRouter();

  return (
    <View style={[styles.container, { bottom: bottomInset }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/event/${event.id}`)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <Image source={event.image} style={styles.image} resizeMode="cover" />
        <View style={styles.content}>
          <AppText style={styles.title} numberOfLines={2}>
            {event.title}
          </AppText>
          <AppText style={styles.meta} numberOfLines={1}>
            {formatEventDateTime(event)}
          </AppText>
          <AppText style={styles.venue} numberOfLines={1}>
            {event.venue}, {event.city}
          </AppText>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            hitSlop={8}
            onPress={(pressEvent) => {
              pressEvent.stopPropagation();
              onClose();
            }}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={componentSize.iconSm} color={colors.textSecondary} />
          </Pressable>
          <FavoriteButton active={isFavorite} onPress={onToggleFavorite} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radiusRoles.card,
    backgroundColor: colorRoles.cardBackground,
    borderWidth: 1,
    borderColor: colorRoles.cardBorder,
  },
  pressed: {
    opacity: 0.94,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: radiusRoles.eventThumbnail,
    backgroundColor: colors.surfaceElevated,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    ...textRoles.cardTitle,
  },
  meta: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
  venue: {
    ...textRoles.cardSubtitle,
  },
  actions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
