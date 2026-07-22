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

import { IconButton } from '@/components/buttons/IconButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { AdminEventRecord } from '@/data/types/records';
import { buildLoginHref } from '@/features/auth/auth-route-utils';
import { useAuth } from '@/features/auth/AuthContext';
import {
  CONTRIBUTOR_EVENT_CREATE_ROUTE,
  PROFILE_MY_EVENTS_ROUTE,
} from '@/features/create/constants/contributor-event-routes';
import { useEventDraftReferenceData } from '@/features/create/hooks/useEventDraftReferenceData';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import { FilterChip } from '@/features/home/components/FilterChip';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useWebPageTitle } from '@/features/i18n/useWebPageTitle';
import { MyEventCard } from '@/features/my-events/components/MyEventCard';
import {
  filterMyEventsByStatus,
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MyEventsFilter>('all');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
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
      const loaded = await contributorEventService.getMyEvents(userId);
      setEvents(loaded);
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
        const loaded = await contributorEventService.getMyEvents(userId!);
        if (!cancelled) {
          setEvents(loaded);
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
    () => filterMyEventsByStatus(events, filter),
    [events, filter],
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

  const emptyTitle = useMemo(() => {
    if (filter === 'draft') {
      return t('profile.myEvents.empty.noDraftsTitle');
    }
    if (filter === 'review') {
      return t('profile.myEvents.empty.noReviewTitle');
    }
    if (filter === 'published') {
      return t('profile.myEvents.empty.noPublishedTitle');
    }
    if (filter === 'rejected') {
      return t('profile.myEvents.empty.noRejectedTitle');
    }
    return t('profile.myEvents.empty.title');
  }, [filter, t]);

  const emptyDescription = useMemo(() => {
    if (filter === 'draft') {
      return t('profile.myEvents.empty.noDraftsDescription');
    }
    if (filter === 'review') {
      return t('profile.myEvents.empty.noReviewDescription');
    }
    if (filter === 'published') {
      return t('profile.myEvents.empty.noPublishedDescription');
    }
    if (filter === 'rejected') {
      return t('profile.myEvents.empty.noRejectedDescription');
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
                label={
                  option === 'all'
                    ? t('profile.myEvents.filters.all')
                    : t(`profile.myEvents.filters.${option}`)
                }
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
                onWithdraw={handleWithdraw}
                withdrawing={withdrawingId === item.id}
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
