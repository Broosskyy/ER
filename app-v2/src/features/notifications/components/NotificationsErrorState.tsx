import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface NotificationsErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function NotificationsErrorState({ message, onRetry }: NotificationsErrorStateProps) {
  const { t } = useAppTranslation();

  return (
    <View style={styles.container} testID="notifications-error-state">
      <Ionicons name="alert-circle-outline" size={48} color={colorRoles.emptyStateIcon} />
      <AppText style={styles.title}>{t('activity.errorTitle')}</AppText>
      <AppText style={styles.message}>{message}</AppText>
      <PrimaryButton label={t('common.actions.retry')} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...textRoles.sectionTitle,
    textAlign: 'center',
  },
  message: {
    ...textRoles.metadata,
    textAlign: 'center',
    color: colorRoles.emptyStateDescription,
  },
});
