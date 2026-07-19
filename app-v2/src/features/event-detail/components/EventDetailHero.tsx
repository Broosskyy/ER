import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { IconButton } from '@/components/buttons/IconButton';
import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { DemoEvent } from '@/features/events/data/demo-events';

export interface EventDetailHeroProps {
  event: DemoEvent;
  isFavorite: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onShare: () => void;
}

export function EventDetailHero({
  event,
  isFavorite,
  onBack,
  onToggleFavorite,
  onShare,
}: EventDetailHeroProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Image source={event.image} style={styles.image} resizeMode="cover" />
      <View style={styles.overlay} />
      <View style={[styles.actions, { paddingTop: insets.top + spacingTop }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={componentSize.iconMd} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.trailingActions}>
          <IconButton
            icon="share-outline"
            accessibilityLabel="Share event"
            onPress={onShare}
            style={styles.actionButton}
          />
          <FavoriteButton
            active={isFavorite}
            onPress={onToggleFavorite}
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          />
        </View>
      </View>
    </View>
  );
}

const spacingTop = 8;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: componentSize.eventDetailHeroAspectRatio,
    backgroundColor: colors.surfaceElevated,
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colorRoles.imageOverlayGradientEnd,
    opacity: 0.45,
  },
  actions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  backButton: {
    width: componentSize.iconButtonSize,
    height: componentSize.iconButtonSize,
    borderRadius: componentSize.iconButtonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 11, 15, 0.55)',
  },
  trailingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    backgroundColor: 'rgba(11, 11, 15, 0.55)',
  },
  pressed: {
    opacity: 0.85,
  },
});
