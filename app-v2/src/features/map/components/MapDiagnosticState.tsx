import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export function MapDiagnosticState() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Ionicons
        name="map-outline"
        size={componentSize.iconLg * 2}
        color={colorRoles.emptyStateIcon}
      />
      <AppText style={styles.title}>Map temporarily disabled</AppText>
      <AppText style={styles.description}>
        Native map initialization is being checked.
      </AppText>
      <PrimaryButton
        label="Back to Events"
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
