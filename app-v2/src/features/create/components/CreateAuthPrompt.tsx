import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { buildLoginHref, buildRegisterHref } from '@/features/auth/auth-route-utils';
import { CREATE_HUB_RETURN_ROUTE } from '@/features/create/create-hub-config';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface CreateAuthPromptProps {
  onDismiss?: () => void;
}

export function CreateAuthPrompt({ onDismiss }: CreateAuthPromptProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const loginHref = buildLoginHref(CREATE_HUB_RETURN_ROUTE);
  const registerHref = buildRegisterHref(CREATE_HUB_RETURN_ROUTE);

  return (
    <View style={styles.container} testID="create-auth-prompt">
      <AppText style={styles.title}>{t('create.authPrompt.title')}</AppText>
      <AppText style={styles.subtitle}>{t('create.authPrompt.subtitle')}</AppText>
      <View style={styles.actions}>
        <PrimaryButton
          label={t('common.actions.login')}
          onPress={() => {
            onDismiss?.();
            router.push(loginHref as '/login');
          }}
        />
        <SecondaryButton
          label={t('common.actions.register')}
          onPress={() => {
            onDismiss?.();
            router.push(registerHref as '/register');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  actions: {
    gap: spacing.sm,
  },
});
