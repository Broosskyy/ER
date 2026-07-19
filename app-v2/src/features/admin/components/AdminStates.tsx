import { AppText } from '@/components/layout/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { colorRoles, colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function AdminLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} />
      <AppText style={styles.meta}>{label}</AppText>
    </View>
  );
}

export function AdminErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.centered}>
      <AppText style={styles.title}>Something went wrong</AppText>
      <AppText style={styles.meta}>{message}</AppText>
      {onRetry ? <SecondaryButton label="Retry" onPress={onRetry} style={styles.button} /> : null}
    </View>
  );
}

export function AdminEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.centered}>
      <AppText style={styles.title}>{title}</AppText>
      {description ? <AppText style={styles.meta}>{description}</AppText> : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
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
    minWidth: 160,
    marginTop: spacing.sm,
  },
});
