import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export function MapUnavailableState() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Ionicons
        name="map-outline"
        size={componentSize.iconLg * 2}
        color={colorRoles.emptyStateIcon}
      />
      <AppText style={styles.title}>Map is not available yet</AppText>
      <AppText style={styles.description}>
        The event map is being prepared and will be available in a future update.
      </AppText>
      <PrimaryButton
        label="Explore events"
        onPress={() => router.navigate('/(tabs)/search')}
        style={styles.button}
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
});
