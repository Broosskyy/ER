import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export function NotificationsLoadingState() {
  const { t } = useAppTranslation();

  return (
    <View style={styles.container} testID="notifications-loading-state">
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText style={styles.label}>{t('activity.loading')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  label: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
});
