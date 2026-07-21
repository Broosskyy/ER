import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { AdminEventRecord, AdminEventStatus } from '@/data/types/records';
import { adminEventModerationService, adminEventRepository } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { isContributorSubmission } from '@/features/admin/constants/admin-event-status';
import { canEditEvents } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';

const STATUS_FILTERS: Array<AdminEventStatus | 'all'> = [
  'all',
  'draft',
  'review',
  'published',
  'rejected',
  'archived',
];

export default function AdminEventsScreen() {
  const router = useRouter();
  const { session, role } = useAdminAuth();
  const [events, setEvents] = useState<AdminEventRecord[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AdminEventStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminEventRepository.list({
        query,
        status,
        sortBy: 'updated',
        page: 1,
        pageSize: 50,
      });
      setEvents(result.items);
      if (session) {
        const reviewQueue = await adminEventModerationService.listReviewQueue(session);
        setReviewCount(reviewQueue.length);
      } else {
        setReviewCount(0);
      }
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [query, status, session]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading && events.length === 0) {
    return <AdminLoadingState label="Loading events…" />;
  }

  if (error && events.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Back" onPress={() => router.back()} />
          <AppText style={styles.title}>Events</AppText>
          {canEditEvents(role) ? (
            <PrimaryButton label="New" onPress={() => router.push('/admin/events/new')} />
          ) : null}
        </View>
        {reviewCount > 0 ? (
          <Pressable
            style={styles.reviewBanner}
            onPress={() => router.push('/admin/events/review')}
          >
            <AppText style={styles.reviewBannerText}>
              {reviewCount} contributor submission{reviewCount === 1 ? '' : 's'} awaiting review
            </AppText>
          </Pressable>
        ) : null}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search events…"
          placeholderTextColor={colorRoles.emptyStateDescription}
          style={styles.search}
        />
        <View style={styles.filters}>
          {STATUS_FILTERS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setStatus(item)}
              style={[styles.filterChip, status === item && styles.filterChipActive]}
            >
              <AppText style={styles.filterText}>{item}</AppText>
            </Pressable>
          ))}
        </View>
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <AdminEmptyState
              title="No events found"
              description="Try a different search or status filter."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/admin/events/${item.id}`)}
            >
              <View style={styles.rowText}>
                <AppText style={styles.rowTitle}>{item.title}</AppText>
                <AppText style={styles.rowMeta}>
                  {item.status}
                  {isContributorSubmission(item) ? ' · contributor' : ''} ·{' '}
                  {new Date(item.startDate).toLocaleDateString('de-DE')}
                </AppText>
              </View>
            </Pressable>
          )}
        />
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingRoles.screenHorizontal,
    gap: spacing.sm,
  },
  title: { ...textRoles.sectionTitle, flex: 1, textAlign: 'center' },
  search: {
    marginHorizontal: spacingRoles.screenHorizontal,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...textRoles.metadata,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  reviewBanner: {
    marginHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
  },
  reviewBannerText: {
    ...textRoles.metadata,
    color: colors.primary,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowText: { gap: spacing.xs },
  rowTitle: { ...textRoles.metadata, fontWeight: '600' },
  rowMeta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
});
