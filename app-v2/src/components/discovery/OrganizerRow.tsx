import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/spacing';

import { EventImage } from './EventImage';
import type { OrganizerListItemViewModel } from './view-models';

export interface OrganizerRowProps {
  organizer: OrganizerListItemViewModel;
  onPress?: () => void;
  style?: ViewStyle;
}

/** Presentation-only organizer row based on Mockups 11, 38, and 54. */
export function OrganizerRow({ organizer, onPress, style }: OrganizerRowProps) {
  const { theme } = useTheme();
  const content = (
    <View style={[styles.row, style]}>
      {organizer.image ? (
        <EventImage source={organizer.image} variant="compact" style={styles.avatar} />
      ) : (
        <View
          style={[
            styles.fallbackAvatar,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.borderSubtle,
              borderRadius: theme.radii.full,
            },
          ]}
        >
          <AppIcon name="people-outline" size="md" colorRole="accent" />
        </View>
      )}
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <AppText role="bodyStrong" numberOfLines={1}>
            {organizer.name}
          </AppText>
          {organizer.verified ? (
            <AppIcon name="checkmark-circle" size="sm" color={theme.colors.success} />
          ) : null}
        </View>
        {organizer.typeLabel ? (
          <AppText role="metadata" color={theme.colors.accent} numberOfLines={1}>
            {organizer.typeLabel}
          </AppText>
        ) : null}
        {organizer.subtitleLabel ? (
          <AppText role="bodyMuted" numberOfLines={1}>
            {organizer.subtitleLabel}
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
      accessibilityLabel={organizer.accessibilityLabel}
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
  avatar: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: spacing.xxl,
  },
  fallbackAvatar: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  pressed: {
    opacity: 0.88,
  },
});
