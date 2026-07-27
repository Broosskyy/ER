import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { EternalRaveLogo } from '@/components/branding/EternalRaveLogo';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing, spacingRoles } from '@/design/spacing';

export function HomeHeader() {
  const router = useRouter();

  return (
    <View style={styles.container} testID="home-header">
      <EternalRaveLogo style={styles.brand} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aktivitäten öffnen"
        onPress={() => router.push('/activity')}
        style={styles.activityButton}
        testID="home-activity-button"
      >
        <AppIcon name="notifications-outline" size="md" colorRole="muted" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  brand: {
    flexShrink: 0,
  },
  activityButton: {
    position: 'absolute',
    right: spacingRoles.screenHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
});
