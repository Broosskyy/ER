import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { EventSubmissionWizard } from '@/features/create/components/EventSubmissionWizard';
import {
  CONTRIBUTOR_EVENT_CREATE_ROUTE,
  getContributorEventEditRoute,
} from '@/features/create/constants/contributor-event-routes';
import type { WizardMode } from '@/features/create/wizard/wizard-types';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export interface ContributorEventFormScreenProps {
  mode: 'create' | 'edit';
  eventId?: string;
}

export function ContributorEventFormScreen({ mode, eventId }: ContributorEventFormScreenProps) {
  useWebPageTitle(mode === 'create' ? 'webTitles.createEvent' : 'webTitles.editEvent');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ draftId?: string }>();
  const draftId = typeof params.draftId === 'string' ? params.draftId : undefined;

  const loginReturnPath =
    mode === 'edit' && eventId ? getContributorEventEditRoute(eventId) : CONTRIBUTOR_EVENT_CREATE_ROUTE;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(buildLoginHref(loginReturnPath) as '/login');
    }
  }, [authLoading, isAuthenticated, loginReturnPath, router]);

  const linkLabels = useMemo(
    () => ({
      website: t('create.event.form.labels.website'),
      instagram: t('create.event.form.labels.instagram'),
      facebook: t('create.event.form.labels.facebook'),
    }),
    [t],
  );

  const wizardMode: WizardMode = mode === 'edit' ? 'editDraft' : 'create';

  if (authLoading) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <AppText style={styles.loadingText}>{t('common.labels.loading')}</AppText>
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <EventSubmissionWizard
            mode={wizardMode}
            eventId={eventId}
            draftId={draftId}
            userId={user.id}
            linkLabels={linkLabels}
          />
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  loadingText: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
});
