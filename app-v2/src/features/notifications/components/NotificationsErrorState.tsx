import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface NotificationsErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function NotificationsErrorState({ message, onRetry }: NotificationsErrorStateProps) {
  return (
    <View style={styles.container} testID="notifications-error-state">
      <Ionicons name="alert-circle-outline" size={48} color={colorRoles.emptyStateIcon} />
      <AppText style={styles.title}>Aktivitäten konnten nicht geladen werden</AppText>
      <AppText style={styles.message}>{message}</AppText>
      <PrimaryButton label="Erneut versuchen" onPress={onRetry} />
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
