import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { EventDraftCard } from '@/components/organizer/DraftComponents';
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
import { loadEventWizardDrafts } from '@/features/create/wizard/event-wizard-storage';
import type { EventDraft } from '@/features/create/wizard/wizard-types';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export function CreateHubScreen() {
  useWebPageTitle('webTitles.create');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { isAuthenticated } = useAuth();
  const [authPromptOptionId, setAuthPromptOptionId] = useState<CreateOptionId | null>(null);
  const [drafts, setDrafts] = useState<EventDraft[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void loadEventWizardDrafts().then((loaded) => {
      setDrafts(loaded.filter((draft) => draft.status === 'draft'));
    });
  }, [isAuthenticated]);

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

            {isAuthenticated && drafts.length > 0 ? (
              <View style={styles.draftsSection}>
                <AppText accessibilityRole="header" style={styles.draftsTitle}>
                  Entwürfe
                </AppText>
                {drafts.map((draft) => (
                  <EventDraftCard
                    key={draft.id}
                    draft={{
                      id: draft.id,
                      title: draft.formData.core.title || 'Unbenanntes Event',
                      status: 'draft',
                      lastEditedLabel: new Date(draft.updatedAt).toLocaleString('de-DE'),
                      currentStep: draft.completedSteps.length + 1,
                      totalSteps: 12,
                      accessibilityLabel: `Entwurf ${draft.formData.core.title || 'Unbenanntes Event'}`,
                    }}
                    onContinuePress={() =>
                      router.push(
                        draft.eventId
                          ? (`/event/${draft.eventId}/edit` as '/create/event')
                          : (`/create/event?draftId=${encodeURIComponent(draft.id)}` as '/create/event'),
                      )
                    }
                  />
                ))}
              </View>
            ) : null}
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
  draftsSection: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  draftsTitle: {
    ...textRoles.sectionTitle,
  },
});
