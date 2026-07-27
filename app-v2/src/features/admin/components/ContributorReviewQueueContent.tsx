import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AdminReviewCard } from '@/components/admin/AdminReviewComponents';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { AdminEventRecord } from '@/data/types/records';
import {
  adminEventModerationService,
  adminModerationStateService,
  cityRepository,
  venueRepository,
} from '@/data/repositories/registry';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canModerateContributorEvents } from '@/features/admin/admin-permissions';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import type { ModerationQueueStatus } from '@/features/admin/types/moderation-types';
import { resolveModerationQueueStatus } from '@/features/admin/utils/moderation-status';
import { mapAdminEventToReviewCard } from '@/features/admin/utils/admin-review-mapper';

export function ContributorReviewQueueContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { session, role } = useAdminAuth();
  const [entries, setEntries] = useState<
    Array<{
      event: AdminEventRecord;
      cityLabel?: string;
      venueLabel?: string;
      state: Awaited<ReturnType<typeof adminModerationStateService.getState>>;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canModerate = canModerateContributorEvents(role);
  const filter = (params.filter as ModerationQueueStatus | undefined) ?? 'all';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, states, cities, venues] = await Promise.all([
        adminEventModerationService.listContributorEvents(session),
        adminModerationStateService.listStates(),
        cityRepository.getActive(),
        venueRepository.getAll(),
      ]);

      const stateByEventId = new Map(states.map((entry) => [entry.eventId, entry]));
      const cityById = new Map(cities.map((city) => [city.id, city.name]));
      const venueById = new Map(venues.map((venue) => [venue.id, venue.name]));

      const enriched = items.map((event) => ({
        event,
        cityLabel: event.cityId ? cityById.get(event.cityId) : undefined,
        venueLabel: event.venueId
          ? venueById.get(event.venueId)
          : event.venueName ?? undefined,
        state: stateByEventId.get(event.id) ?? null,
      }));

      const filtered =
        filter === 'all'
          ? enriched
          : enriched.filter(
              (entry) =>
                resolveModerationQueueStatus(entry.event, entry.state?.queueStatus) === filter,
            );

      setEntries(filtered);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [filter, session]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const title = useMemo(() => {
    if (filter === 'pending') return 'Ausstehende Einreichungen';
    if (filter === 'in_review') return 'In Prüfung';
    if (filter === 'approved') return 'Genehmigte Events';
    if (filter === 'needs_changes') return 'Änderungen erforderlich';
    if (filter === 'published') return 'Veröffentlichte Events';
    if (filter === 'rejected') return 'Abgelehnte Events';
    return 'Einreichungen';
  }, [filter]);

  if (loading && entries.length === 0) {
    return <AdminLoadingState label="Einreichungen werden geladen…" />;
  }

  if (error && entries.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Zurück" onPress={() => router.back()} />
          <AppText style={styles.title}>{title}</AppText>
        </View>

        <AppText style={styles.description}>
          {canModerate
            ? 'Prüfe eingereichte Events, fordere Änderungen an oder gib sie frei.'
            : 'Nur-Lese-Zugriff für deine Rolle.'}
        </AppText>

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        <View style={adminPageLayoutStyles.listRegion}>
          <FlatList
            style={adminPageLayoutStyles.flexScroll}
            data={entries}
            keyExtractor={(item) => item.event.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <AdminEmptyState
                title="Keine Einreichungen"
                description="Sobald Organizer Events einreichen, erscheinen sie hier."
              />
            }
            renderItem={({ item }) => {
              const review = mapAdminEventToReviewCard(item.event, {
                cityLabel: item.cityLabel,
                venueLabel: item.venueLabel,
                state: item.state,
              });
              return (
                <AdminReviewCard
                  review={review}
                  onPreviewPress={() => router.push(`/admin/events/review/${item.event.id}`)}
                  onApprovePress={
                    canModerate
                      ? () => router.push(`/admin/events/review/${item.event.id}`)
                      : undefined
                  }
                  onRequestChangesPress={
                    canModerate
                      ? () => router.push(`/admin/events/review/${item.event.id}`)
                      : undefined
                  }
                  onRejectPress={
                    canModerate
                      ? () => router.push(`/admin/events/review/${item.event.id}`)
                      : undefined
                  }
                />
              );
            }}
          />
        </View>

        <PrimaryButton label="Aktualisieren" onPress={() => void load()} />
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacingRoles.screenHorizontal,
  },
  title: { ...textRoles.sectionTitle, flex: 1 },
  description: {
    ...textRoles.metadata,
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.sm,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    flexGrow: 1,
  },
});
