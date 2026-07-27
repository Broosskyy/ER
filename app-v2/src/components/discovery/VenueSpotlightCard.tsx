import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { EventImage } from './EventImage';
import type { VenueListItemViewModel } from './view-models';

export interface VenueSpotlightCardProps {
  venue: VenueListItemViewModel;
  width: number;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Image-forward club card for home horizontal rails (Mockup 09 Top Clubs). */
export function VenueSpotlightCard({
  venue,
  width,
  onPress,
  style,
  testID,
}: VenueSpotlightCardProps) {
  const { theme } = useTheme();

  const content = (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          width,
          borderRadius: theme.radiusRoles.card,
        },
        style,
      ]}
    >
      <EventImage
        source={venue.image}
        variant="spotlight"
        overlay={
          <>
            <View style={[styles.scrimTop, { backgroundColor: theme.colors.overlay }]} />
            <View style={[styles.bottomOverlay, { backgroundColor: theme.colors.overlay }]}>
              <AppText role="cardTitle" color={theme.colors.textOnPrimary} numberOfLines={1}>
                {venue.name}
              </AppText>
              <View style={styles.cityRow}>
                <AppIcon name="location" size="sm" color={theme.colors.textOnPrimary} />
                <AppText role="caption" color={theme.colors.textOnPrimary} numberOfLines={1}>
                  {venue.cityLabel}
                </AppText>
              </View>
            </View>
          </>
        }
      />
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={venue.accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    opacity: 0.35,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    opacity: 0.92,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.9,
  },
});
