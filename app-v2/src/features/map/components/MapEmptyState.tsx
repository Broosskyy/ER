import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface MapEmptyStateProps {
  onExploreEvents: () => void;
}

export function MapEmptyState({ onExploreEvents }: MapEmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons
        name="map-outline"
        size={componentSize.iconLg * 2}
        color={colorRoles.emptyStateIcon}
      />
      <AppText style={styles.title}>No events on the map</AppText>
      <AppText style={styles.description}>
        There are currently no events with map coordinates available.
      </AppText>
      <PrimaryButton label="Explore events" onPress={onExploreEvents} style={styles.button} />
    </View>
  );
}

export function MapErrorState({
  onRetry,
  onExploreEvents,
}: {
  onRetry: () => void;
  onExploreEvents?: () => void;
}) {
  const router = useRouter();

  const handleExploreEvents = () => {
    if (onExploreEvents) {
      onExploreEvents();
      return;
    }

    router.navigate('/(tabs)/search');
  };

  return (
    <View style={styles.container}>
      <Ionicons
        name="warning-outline"
        size={componentSize.iconLg * 2}
        color={colorRoles.emptyStateIcon}
      />
      <AppText style={styles.title}>Map unavailable</AppText>
      <AppText style={styles.description}>
        The map could not be loaded. Please try again.
      </AppText>
      <PrimaryButton label="Retry" onPress={onRetry} style={styles.button} />
      <PrimaryButton
        label="Go to Events"
        onPress={handleExploreEvents}
        style={styles.secondaryButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
    backgroundColor: colorRoles.screenBackground,
  },
  title: {
    ...textRoles.sectionTitle,
    textAlign: 'center',
    color: colorRoles.emptyStateTitle,
  },
  description: {
    ...textRoles.metadata,
    textAlign: 'center',
    color: colorRoles.emptyStateDescription,
    marginBottom: spacing.md,
  },
  button: {
    minWidth: 200,
  },
  secondaryButton: {
    minWidth: 200,
    marginTop: spacing.sm,
  },
});
