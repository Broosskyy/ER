import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { AdminEventRecord } from '@/data/types/records';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import {
  buildContributorEventSubmittedHref,
  getContributorEventEditRoute,
  getContributorEventPreviewRoute,
} from '@/features/create/constants/contributor-event-routes';
import {
  contributorEventService,
  submitContributorEventForReview,
} from '@/features/create/services/contributor-event-service';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export function EventDraftSuccessScreen() {
  useWebPageTitle('webTitles.createEventSuccess');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === 'string' ? params.id : undefined;
  const [draft, setDraft] = useState<AdminEventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(buildLoginHref('/create/event') as '/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const shouldLoadDraft = Boolean(user?.id) && Boolean(eventId);
  const userId = user?.id;

  const reloadDraft = useCallback(async () => {
    if (!userId || !eventId) {
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const record = await contributorEventService.getEvent(eventId, userId);
      setDraft(record?.status === 'draft' ? record : null);
    } catch (cause) {
      setLoadError(getErrorMessage(cause) || t('create.event.success.loadError'));
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, [eventId, t, userId]);

  useEffect(() => {
    if (!shouldLoadDraft || !userId || !eventId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const record = await contributorEventService.getEvent(eventId, userId);
        if (!cancelled) {
          setDraft(record?.status === 'draft' ? record : null);
        }
      } catch (cause) {
        if (!cancelled) {
          setLoadError(getErrorMessage(cause) || t('create.event.success.loadError'));
          setDraft(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, shouldLoadDraft, t, userId]);

  const handleSubmitForReview = async () => {
    if (!user?.id || !draft || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await submitContributorEventForReview({ eventId: draft.id, userId: user.id });
      router.replace(buildContributorEventSubmittedHref(draft.id) as '/create/event/submitted');
    } catch (cause) {
      setSubmitError(getErrorMessage(cause) || t('create.event.errors.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!eventId) {
    return <Redirect href="/create" />;
  }

  if (authLoading || (shouldLoadDraft && loading)) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (loadError || !draft) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.safeArea}>
          <ResponsiveScreen>
            <View style={styles.content}>
              <AppText accessibilityRole="alert" style={styles.errorText}>
                {loadError ?? t('create.event.success.loadError')}
              </AppText>
              <PrimaryButton label={t('common.actions.retry')} onPress={() => void reloadDraft()} />
              <SecondaryButton
                label={t('create.event.success.backToCreate')}
                onPress={() => router.replace('/create')}
              />
            </View>
          </ResponsiveScreen>
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.safeArea}>
        <ResponsiveScreen>
          <View style={styles.content}>
            <AppText accessibilityRole="header" style={styles.title}>
              {t('create.event.success.title')}
            </AppText>
            <AppText style={styles.message}>{t('create.event.success.message')}</AppText>
            <View style={styles.summaryCard}>
              <AppText style={styles.summaryLabel}>{t('create.event.success.eventName')}</AppText>
              <AppText style={styles.summaryValue}>{draft.title}</AppText>
              <AppText style={styles.summaryLabel}>{t('create.event.success.status')}</AppText>
              <AppText style={styles.summaryValue}>{t('create.event.success.statusDraft')}</AppText>
            </View>
            {submitError ? (
              <AppText accessibilityRole="alert" style={styles.errorText}>
                {submitError}
              </AppText>
            ) : null}
            <PrimaryButton
              label={t('create.event.success.openDraft')}
              onPress={() => router.replace(getContributorEventEditRoute(draft.id))}
              disabled={submitting}
            />
            <SecondaryButton
              label={t('create.event.success.continueEditing')}
              onPress={() => router.replace(getContributorEventEditRoute(draft.id))}
              disabled={submitting}
            />
            <SecondaryButton
              label={t('create.event.success.preview')}
              onPress={() => router.push(getContributorEventPreviewRoute(draft.id))}
              disabled={submitting}
            />
            <SecondaryButton
              label={
                submitting
                  ? t('create.event.success.submitting')
                  : t('create.event.success.submitForReview')
              }
              onPress={() => void handleSubmitForReview()}
              disabled={submitting}
            />
            <SecondaryButton
              label={t('create.event.success.createAnother')}
              onPress={() => router.replace('/create/event')}
              disabled={submitting}
            />
            <SecondaryButton
              label={t('create.event.success.backToCreate')}
              onPress={() => router.replace('/create')}
              disabled={submitting}
            />
          </View>
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
  },
  content: {
    flex: 1,
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    ...textRoles.screenTitle,
  },
  message: {
    ...textRoles.body,
    color: colorRoles.emptyStateDescription,
  },
  summaryCard: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  summaryLabel: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...textRoles.body,
    color: colors.live,
    textAlign: 'center',
  },
});
