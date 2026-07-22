import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { AdminEventRecord } from '@/data/types/records';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import { EventDraftPreview } from '@/features/create/components/EventDraftPreview';
import { EventSubmitActions } from '@/features/create/components/EventSubmitActions';
import {
  getContributorEventEditRoute,
  PROFILE_MY_EVENTS_ROUTE,
  buildContributorEventSubmittedHref,
} from '@/features/create/constants/contributor-event-routes';
import { useEventDraftReferenceData } from '@/features/create/hooks/useEventDraftReferenceData';
import {
  contributorEventService,
  submitContributorEventForReview,
} from '@/features/create/services/contributor-event-service';
import { resolveEventVenueDisplay } from '@/features/create/utils/event-venue-display';
import { useEventStatusLabel } from '@/features/my-events/hooks/useEventStatusLabel';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';

export function EventDraftPreviewScreen() {
  useWebPageTitle('webTitles.eventPreview');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === 'string' ? params.id : undefined;
  const { data: referenceData, loading: optionsLoading } = useEventDraftReferenceData();
  const [record, setRecord] = useState<AdminEventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(
        buildLoginHref(eventId ? `/event/${eventId}/preview` : '/create') as '/login',
      );
    }
  }, [authLoading, eventId, isAuthenticated, router]);

  const shouldLoadRecord = Boolean(user?.id) && Boolean(eventId);

  useEffect(() => {
    if (!shouldLoadRecord) {
      return;
    }

    let cancelled = false;
    void contributorEventService.getEvent(eventId!, user!.id).then((loaded) => {
      if (!cancelled) {
        setRecord(loaded && (loaded.status === 'draft' || loaded.status === 'review') ? loaded : null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldLoadRecord, eventId, user]);

  const linkLabels = useMemo(
    () => ({
      website: t('create.event.form.labels.website'),
      instagram: t('create.event.form.labels.instagram'),
      facebook: t('create.event.form.labels.facebook'),
    }),
    [t],
  );

  const venueDisplay = useMemo(() => {
    if (!record) {
      return { label: '', isSuggestion: false };
    }
    return resolveEventVenueDisplay(record, referenceData.venues);
  }, [record, referenceData.venues]);

  const genreLabel = useMemo(() => {
    if (!record?.genreId) {
      return '';
    }
    return referenceData.genreOptions.find((entry) => entry.id === record.genreId)?.label ?? '';
  }, [record, referenceData.genreOptions]);

  const statusLabel = useEventStatusLabel(record?.status ?? 'draft');

  const handleSubmit = async () => {
    if (!user?.id || !eventId || submitting || record?.status !== 'draft') {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await submitContributorEventForReview({ eventId, userId: user.id });
      router.replace(buildContributorEventSubmittedHref(eventId) as '/create/event/submitted');
    } catch (cause) {
      setSubmitError(getErrorMessage(cause) || t('create.event.errors.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = () => {
    if (!user?.id || !eventId || submitting || record?.status !== 'review') {
      return;
    }

    Alert.alert(t('events.withdraw.confirmTitle'), t('events.withdraw.confirmDescription'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('events.actions.withdraw'),
        onPress: () => {
          void (async () => {
            setSubmitting(true);
            setSubmitError(null);
            try {
              await contributorEventService.withdrawFromReview({ eventId, userId: user.id });
              router.replace(PROFILE_MY_EVENTS_ROUTE);
            } catch (cause) {
              setSubmitError(getErrorMessage(cause) || t('profile.myEvents.error'));
            } finally {
              setSubmitting(false);
            }
          })();
        },
      },
    ]);
  };

  if (!eventId) {
    return <Redirect href="/create" />;
  }

  if (authLoading || (shouldLoadRecord && loading) || optionsLoading) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </SafeAreaContainer>
      </AppScreen>
    );
  }

  if (!isAuthenticated || !user || !record) {
    return <Redirect href={PROFILE_MY_EVENTS_ROUTE} />;
  }

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
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <AppText accessibilityRole="header" style={styles.title}>
              {t('create.event.preview.title')}
            </AppText>
            <AppText style={styles.subtitle}>{t('create.event.preview.subtitle')}</AppText>

            <EventDraftPreview
              record={record}
              venueLabel={venueDisplay.label}
              venueIsSuggestion={venueDisplay.isSuggestion}
              genreLabel={genreLabel}
              statusLabel={statusLabel}
              linkLabels={linkLabels}
              labels={{
                cover: t('create.event.form.labels.coverImage'),
                flyer: t('create.event.form.labels.flyerImage'),
                date: t('create.event.preview.date'),
                time: t('create.event.preview.time'),
                venue: t('create.event.preview.venue'),
                genre: t('create.event.form.labels.genre'),
                description: t('create.event.preview.description'),
                links: t('create.event.preview.links'),
                ticket: t('create.event.form.labels.ticketUrl'),
                website: t('create.event.form.labels.website'),
                instagram: t('create.event.form.labels.instagram'),
                facebook: t('create.event.form.labels.facebook'),
                noCover: t('create.event.preview.noCover'),
                status: t('events.status.label'),
                venueSuggestion: t('events.venue.suggestion'),
              }}
            />

            {submitError ? (
              <AppText accessibilityRole="alert" style={styles.error}>
                {submitError}
              </AppText>
            ) : null}

            {record.status === 'draft' ? (
              <EventSubmitActions
                labels={{
                  edit: t('create.event.preview.actions.edit'),
                  submit: t('create.event.preview.actions.submit'),
                  submitting: t('create.event.preview.actions.submitting'),
                }}
                submitting={submitting}
                onEdit={() => router.push(getContributorEventEditRoute(eventId))}
                onSubmit={() => void handleSubmit()}
              />
            ) : null}

            {record.status === 'review' ? (
              <View style={styles.reviewActions}>
                <SecondaryButton
                  label={submitting ? t('events.actions.withdrawing') : t('events.actions.withdraw')}
                  onPress={handleWithdraw}
                  disabled={submitting}
                />
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacingRoles.listBottomInset,
  },
  title: {
    ...textRoles.screenTitle,
  },
  subtitle: {
    ...textRoles.body,
    color: colors.textSecondary,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
  reviewActions: {
    gap: spacing.sm,
  },
});
