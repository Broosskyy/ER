import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/spacing';

import { EventImage } from './EventImage';
import type { LineupItemViewModel } from './view-models';

export interface LineupItemProps {
  artist: LineupItemViewModel;
  onPress?: () => void;
  style?: ViewStyle;
}

/** Compact artist lineup row; no artist profile or follow behavior. */
export function LineupItem({ artist, onPress, style }: LineupItemProps) {
  const { theme } = useTheme();
  const content = (
    <View style={[styles.row, style]}>
      {artist.image ? (
        <EventImage source={artist.image} variant="compact" style={styles.image} />
      ) : (
        <AppIcon name="headset-outline" size="md" colorRole="accent" />
      )}
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <AppText role="bodyStrong" numberOfLines={1}>
            {artist.name}
          </AppText>
          {artist.headliner ? (
            <AppText role="badge" color={theme.colors.accent}>
              Headliner
            </AppText>
          ) : null}
        </View>
        {artist.subtitleLabel ? (
          <AppText role="bodyMuted" numberOfLines={1}>
            {artist.subtitleLabel}
          </AppText>
        ) : null}
      </View>
      {onPress ? <AppIcon name="chevron-forward" size="sm" colorRole="muted" /> : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={artist.accessibilityLabel}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  image: {
    width: spacing.xxl,
    height: spacing.xxl,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.88,
  },
});
