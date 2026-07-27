import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { IconButton } from '@/components/buttons/IconButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppText } from '@/components/layout/AppText';
import { getErrorMessage } from '@/core/errors/app-error';
import type { AdminEventRecord } from '@/data/types/records';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import {
  CONTRIBUTOR_EVENT_CREATE_ROUTE,
  PROFILE_MY_EVENTS_ROUTE,
} from '@/features/create/constants/contributor-event-routes';
import { useEventDraftReferenceData } from '@/features/create/hooks/useEventDraftReferenceData';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import { loadEventSubmissions } from '@/features/create/wizard/event-submission-service';
import type { EventSubmission } from '@/features/create/wizard/wizard-types';
import { FilterChip } from '@/features/home/components/FilterChip';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';
import { MyEventCard } from '@/features/my-events/components/MyEventCard';
import {
  filterMyEventsByStatus,
  indexSubmissionsByEventId,
  MY_EVENTS_FILTER_OPTIONS,
  type MyEventsFilter,
} from '@/features/my-events/utils/my-events-filters';

export function MyEventsScreen() {
  useWebPageTitle('webTitles.myEvents');
  const router = useRouter();
  const { t } = useAppTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { data: referenceData, loading: optionsLoading } = useEventDraftReferenceData();
  const [events, setEvents] = useState<AdminEventRecord[]>([]);
  const [submissionsByEventId, setSubmissionsByEventId] = useState<Record<string, EventSubmission>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MyEventsFilter>('all');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(buildLoginHref(PROFILE_MY_EVENTS_ROUTE) as '/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const userId = user?.id;

  const loadEvents = useCallback(async () => {
    if (!userId) {
      return;
    }

    setError(null);
    try {
      const [loaded, submissions] = await Promise.all([
        contributorEventService.getMyEvents(userId),
        loadEventSubmissions(),
      ]);
      setEvents(loaded);
      setSubmissionsByEventId(indexSubmissionsByEventId(submissions));
    } catch (cause) {
      setError(getErrorMessage(cause) || t('profile.myEvents.error'));
    }
  }, [t, userId]);

  const shouldLoadEvents = Boolean(userId);

  useEffect(() => {
    if (!shouldLoadEvents) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        const [loaded, submissions] = await Promise.all([
          contributorEventService.getMyEvents(userId!),
          loadEventSubmissions(),
        ]);
        if (!cancelled) {
          setEvents(loaded);
          setSubmissionsByEventId(indexSubmissionsByEventId(submissions));
        }
      } catch (cause) {
        if (!cancelled) {
          setError(getErrorMessage(cause) || t('profile.myEvents.error'));
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
  }, [shouldLoadEvents, t, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        return;
      }

      void loadEvents();
    }, [loadEvents, user?.id]),
  );

  const filteredEvents = useMemo(
    () => filterMyEventsByStatus(events, filter, submissionsByEventId),
    [events, filter, submissionsByEventId],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handleWithdraw = (eventId: string) => {
    if (!user?.id || withdrawingId) {
      return;
    }

    Alert.alert(t('events.withdraw.confirmTitle'), t('events.withdraw.confirmDescription'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('events.actions.withdraw'),
        onPress: () => {
          void (async () => {
            setWithdrawingId(eventId);
            setSuccessMessage(null);
            try {
              await contributorEventService.withdrawFromReview({ eventId, userId: user.id });
              await loadEvents();
              setSuccessMessage(t('events.withdraw.success'));
            } catch (cause) {
              setError(getErrorMessage(cause) || t('profile.myEvents.error'));
            } finally {
              setWithdrawingId(null);
            }
          })();
        },
      },
    ]);
  };

  const handleDelete = (eventId: string) => {
    if (!user?.id || deletingId) {
      return;
    }

    void (async () => {
      setDeletingId(eventId);
      setSuccessMessage(null);
      try {
        await contributorEventService.deleteDraft({ eventId, userId: user.id });
        await loadEvents();
        setSuccessMessage(t('profile.myEvents.delete.success'));
      } catch (cause) {
        setError(getErrorMessage(cause) || t('profile.myEvents.error'));
      } finally {
        setDeletingId(null);
      }
    })();
  };

  const handleResubmit = (eventId: string) => {
    if (!user?.id || resubmittingId) {
      return;
    }

    void (async () => {
      setResubmittingId(eventId);
      setSuccessMessage(null);
      try {
        await contributorEventService.resubmitForReview({ eventId, userId: user.id });
        await loadEvents();
        setSuccessMessage(t('profile.myEvents.resubmit.success'));
      } catch (cause) {
        setError(getErrorMessage(cause) || t('profile.myEvents.error'));
      } finally {
        setResubmittingId(null);
      }
    })();
  };

  const emptyTitle = useMemo(() => {
    if (filter === 'draft') {
      return t('profile.myEvents.empty.noDraftsTitle');
    }
    if (filter === 'submitted') {
      return t('profile.myEvents.empty.noSubmittedTitle');
    }
    if (filter === 'in_review') {
      return t('profile.myEvents.empty.noReviewTitle');
    }
    if (filter === 'needs_changes') {
      return t('profile.myEvents.empty.noNeedsChangesTitle');
    }
    if (filter === 'published') {
      return t('profile.myEvents.empty.noPublishedTitle');
    }
    if (filter === 'archived') {
      return t('profile.myEvents.empty.noArchivedTitle');
    }
    return t('profile.myEvents.empty.title');
  }, [filter, t]);

  const emptyDescription = useMemo(() => {
    if (filter === 'draft') {
      return t('profile.myEvents.empty.noDraftsDescription');
    }
    if (filter === 'submitted') {
      return t('profile.myEvents.empty.noSubmittedDescription');
    }
    if (filter === 'in_review') {
      return t('profile.myEvents.empty.noReviewDescription');
    }
    if (filter === 'needs_changes') {
      return t('profile.myEvents.empty.noNeedsChangesDescription');
    }
    if (filter === 'published') {
      return t('profile.myEvents.empty.noPublishedDescription');
    }
    if (filter === 'archived') {
      return t('profile.myEvents.empty.noArchivedDescription');
    }
    return t('profile.myEvents.empty.description');
  }, [filter, t]);

  if (authLoading || (shouldLoadEvents && loading) || optionsLoading) {
    return (
      <AppScreen>
        <SafeAreaContainer style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <AppText style={styles.loadingText}>{t('profile.myEvents.loading')}</AppText>
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
          <View style={styles.header}>
            <IconButton
              icon="arrow-back"
              accessibilityLabel={t('common.actions.back')}
              onPress={() => router.back()}
            />
          </View>

          <AppText accessibilityRole="header" style={styles.title}>
            {t('profile.myEvents.title')}
          </AppText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {MY_EVENTS_FILTER_OPTIONS.map((option) => (
              <FilterChip
                key={option}
                label={t(`profile.myEvents.filters.${option}`)}
                selected={filter === option}
                onPress={() => setFilter(option)}
              />
            ))}
          </ScrollView>

          {successMessage ? (
            <AppText accessibilityRole="alert" style={styles.success}>
              {successMessage}
            </AppText>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <AppText accessibilityRole="alert" style={styles.errorText}>
                {error}
              </AppText>
              <SecondaryButton label={t('common.actions.retry')} onPress={() => void loadEvents()} />
            </View>
          ) : null}

          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
            }
            ListEmptyComponent={
              <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                action={
                  filter === 'all' || filter === 'draft' ? (
                    <PrimaryButton
                      label={t('profile.myEvents.createEvent')}
                      onPress={() => router.push(CONTRIBUTOR_EVENT_CREATE_ROUTE)}
                    />
                  ) : undefined
                }
              />
            }
            renderItem={({ item }) => (
              <MyEventCard
                event={item}
                venues={referenceData.venues}
                submission={submissionsByEventId[item.id]}
                onWithdraw={handleWithdraw}
                onDelete={handleDelete}
                onResubmit={handleResubmit}
                withdrawing={withdrawingId === item.id}
                deleting={deletingId === item.id}
                resubmitting={resubmittingId === item.id}
              />
            )}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  title: {
    ...textRoles.screenTitle,
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.md,
  },
  filters: {
    gap: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  list: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacingRoles.listBottomInset,
  },
  errorBox: {
    gap: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.md,
  },
  errorText: {
    ...textRoles.metadata,
    color: colors.live,
  },
  success: {
    ...textRoles.metadata,
    color: colors.primary,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.sm,
  },
});
