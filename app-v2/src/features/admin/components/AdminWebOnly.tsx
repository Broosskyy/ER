import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export function AdminWebOnlyState() {
  const router = useRouter();

  return (
    <View style={styles.centered}>
      <AppText style={styles.title}>Admin is web-only</AppText>
      <AppText style={styles.meta}>
        The Eternal Rave admin area is available in the browser. Open /admin on desktop or mobile web.
      </AppText>
      <PrimaryButton label="Back to app" onPress={() => router.replace('/')} style={styles.button} />
      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <AppText style={styles.link}>Go back</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingRoles.screenHorizontal,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: {
    ...textRoles.sectionTitle,
    textAlign: 'center',
  },
  meta: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    textAlign: 'center',
  },
  button: {
    minWidth: 180,
    marginTop: spacing.sm,
  },
  link: {
    ...textRoles.metadata,
    color: colors.primary,
    marginTop: spacing.sm,
  },
});
