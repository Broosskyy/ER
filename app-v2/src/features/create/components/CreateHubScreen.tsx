import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useAuth } from '@/features/auth/AuthContext';
import { CreateAuthPrompt } from '@/features/create/components/CreateAuthPrompt';
import { CreateOptionCard } from '@/features/create/components/CreateOptionCard';
import {
  getVisibleCreateOptions,
  getCreateOptionTargetHref,
  shouldPromptCreateAuth,
  type CreateOptionId,
} from '@/features/create/create-hub-config';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export function CreateHubScreen() {
  useWebPageTitle('webTitles.create');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { isAuthenticated } = useAuth();
  const [authPromptOptionId, setAuthPromptOptionId] = useState<CreateOptionId | null>(null);

  const handleOptionPress = useCallback(
    (optionId: CreateOptionId) => {
      if (shouldPromptCreateAuth(optionId, isAuthenticated)) {
        setAuthPromptOptionId(optionId);
        return;
      }

      const targetHref = getCreateOptionTargetHref(optionId, isAuthenticated);
      if (!targetHref) {
        return;
      }

      setAuthPromptOptionId(null);
      router.push(targetHref as '/register');
    },
    [isAuthenticated, router],
  );

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <View style={styles.header}>
            <IconButton
              icon="arrow-back"
              accessibilityLabel={t('common.actions.back')}
              onPress={() => router.back()}
            />
            <View style={styles.headerCopy}>
              <AppText accessibilityRole="header" style={styles.title}>
                {t('create.title')}
              </AppText>
              <AppText style={styles.subtitle}>{t('create.subtitle')}</AppText>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {authPromptOptionId ? <CreateAuthPrompt onDismiss={() => setAuthPromptOptionId(null)} /> : null}

            {getVisibleCreateOptions().map((option) => (
              <CreateOptionCard
                key={option.id}
                icon={option.icon}
                title={t(`create.options.${option.id}.title`)}
                description={t(`create.options.${option.id}.description`)}
                onPress={() => handleOptionPress(option.id)}
              />
            ))}
          </ScrollView>
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  title: {
    ...textRoles.screenTitle,
  },
  subtitle: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  list: {
    gap: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacingRoles.listBottomInset,
  },
});
