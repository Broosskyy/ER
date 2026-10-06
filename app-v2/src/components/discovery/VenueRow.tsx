import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/spacing';

import { EventImage } from './EventImage';
import type { VenueListItemViewModel } from './view-models';

export interface VenueRowProps {
  venue: VenueListItemViewModel;
  onPress?: () => void;
  style?: ViewStyle;
}

/** Presentational venue row based on event pin rows and the Mockup 54 venue card. */
export function VenueRow({ venue, onPress, style }: VenueRowProps) {
  const { theme } = useTheme();
  const content = (
    <View style={[styles.row, style]}>
      {venue.image ? (
        <EventImage source={venue.image} variant="compact" style={styles.image} />
      ) : (
        <AppIcon name="business-outline" size="md" colorRole="accent" />
      )}
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <AppText role="bodyStrong" numberOfLines={1}>
            {venue.name}
          </AppText>
          {venue.verified ? <AppIcon name="checkmark-circle" size="sm" color={theme.colors.success} /> : null}
        </View>
        <View style={styles.metaRow}>
          <AppIcon name="location" size="sm" colorRole="accent" />
          <AppText role="bodyMuted" numberOfLines={1}>
            {venue.cityLabel}
          </AppText>
        </View>
        {venue.subtitleLabel ? (
          <AppText role="caption" numberOfLines={1}>
            {venue.subtitleLabel}
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
      accessibilityLabel={venue.accessibilityLabel}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.88,
  },
});
