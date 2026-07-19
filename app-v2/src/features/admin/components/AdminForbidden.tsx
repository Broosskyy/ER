import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { StyleSheet, View } from 'react-native';

export function AdminForbiddenState({
  title = 'Access denied',
  message = 'You do not have permission to view this admin area.',
}: {
  title?: string;
  message?: string;
}) {
  const { signOut, roleError } = useAdminAuth();

  return (
    <View style={styles.centered}>
      <AppText style={styles.title}>{title}</AppText>
      <AppText style={styles.meta}>{roleError ?? message}</AppText>
      <SecondaryButton label="Logout" onPress={signOut} style={styles.button} />
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
    minWidth: 160,
    marginTop: spacing.sm,
  },
});
