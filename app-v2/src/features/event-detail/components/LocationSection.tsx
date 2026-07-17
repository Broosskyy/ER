import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { DemoEvent } from '@/features/events/data/demo-events';

export interface LocationSectionProps {
  event: DemoEvent;
  onOpenMaps: () => void;
}

export function LocationSection({ event, onOpenMaps }: LocationSectionProps) {
  return (
    <View style={styles.card}>
      <AppText style={styles.venue}>{event.venue}</AppText>
      {event.address ? <AppText style={styles.address}>{event.address}</AppText> : null}
      <AppText style={styles.city}>{event.city}</AppText>

      {event.address ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenMaps}
          style={({ pressed }) => [styles.mapsButton, pressed && styles.pressed]}
        >
          <AppText style={styles.mapsLabel}>Open in Maps</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colorRoles.cardBackground,
    borderRadius: radiusRoles.card,
    borderWidth: 1,
    borderColor: colorRoles.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  venue: {
    ...textRoles.cardTitle,
  },
  address: {
    ...textRoles.body,
    color: colors.textSecondary,
  },
  city: {
    ...textRoles.metadata,
  },
  mapsButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  mapsLabel: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
