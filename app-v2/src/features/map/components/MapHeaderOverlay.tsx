import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface MapHeaderOverlayProps {
  cityLabel: string;
  eventCount: number;
}

export function MapHeaderOverlay({ cityLabel, eventCount }: MapHeaderOverlayProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { top: insets.top + spacing.sm }]}>
      <View style={styles.card}>
        <Ionicons name="map-outline" size={18} color={colors.primary} />
        <View style={styles.textWrap}>
          <AppText style={styles.title}>Events near {cityLabel}</AppText>
          <AppText style={styles.subtitle}>
            {eventCount === 1 ? '1 event on map' : `${eventCount} events on map`}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacingRoles.screenHorizontal,
    right: spacingRoles.screenHorizontal,
    zIndex: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radiusRoles.card,
    backgroundColor: 'rgba(21, 21, 27, 0.92)',
    borderWidth: 1,
    borderColor: colorRoles.cardBorder,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...textRoles.cardTitle,
    fontSize: 15,
  },
  subtitle: {
    ...textRoles.metadata,
  },
});
