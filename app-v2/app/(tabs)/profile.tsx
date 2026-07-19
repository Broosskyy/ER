import { StyleSheet, View } from 'react-native';

import { AppScreen, AppText, SafeAreaContainer, ScreenContent } from '@/components';
import { colors } from '@/design/colors';
import { appConfig } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useFavorites } from '@/features/favorites';

export default function ProfileScreen() {
  const { favoriteEvents, isHydrated } = useFavorites();
  const savedCount = isHydrated ? favoriteEvents.length : 0;

  return (
    <AppScreen>
      <SafeAreaContainer>
        <ScreenContent style={styles.content}>
          <AppText variant="heading">Profile</AppText>

          <View style={styles.card}>
            <AppText style={styles.label}>Default city</AppText>
            <AppText style={styles.value}>{appConfig.defaultCity}, Germany</AppText>
          </View>

          <View style={styles.card}>
            <AppText style={styles.label}>Saved events</AppText>
            <AppText style={styles.value}>{isHydrated ? savedCount : '…'}</AppText>
            <AppText variant="bodySmall" color={colors.textSecondary} style={styles.note}>
              Favorites are stored locally on this device. They are not synced to the cloud yet.
            </AppText>
          </View>
        </ScreenContent>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'stretch',
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.lg,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  value: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
  },
  note: {
    marginTop: spacing.xs,
  },
});
