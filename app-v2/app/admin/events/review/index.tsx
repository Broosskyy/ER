import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { AdminEventRecord } from '@/data/types/records';
import { adminEventModerationService } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canModerateContributorEvents } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';

export default function ContributorReviewQueueScreen() {
  const router = useRouter();
  const { session, role } = useAdminAuth();
  const [events, setEvents] = useState<AdminEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canModerate = canModerateContributorEvents(role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await adminEventModerationService.listReviewQueue(session);
      setEvents(items);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading && events.length === 0) {
    return <AdminLoadingState label="Loading contributor submissions…" />;
  }

  if (error && events.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Back" onPress={() => router.back()} />
          <AppText style={styles.title}>Contributor Submissions</AppText>
        </View>

        <AppText style={styles.description}>
          Events submitted by community contributors awaiting moderation.
          {canModerate ? ' Publish or reject each submission.' : ' View-only access for your role.'}
        </AppText>

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        <View style={adminPageLayoutStyles.listRegion}>
          <FlatList
            style={adminPageLayoutStyles.flexScroll}
            data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <AdminEmptyState
              title="No submissions in review"
              description="Contributor events will appear here after they submit for review."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/admin/events/review/${item.id}`)}
            >
              <View style={styles.rowText}>
                <AppText style={styles.rowTitle}>{item.title || 'Untitled event'}</AppText>
                <AppText style={styles.rowMeta}>
                  {new Date(item.startDate).toLocaleDateString('de-DE')} · Contributor{' '}
                  {item.createdBy?.slice(0, 8) ?? '—'}
                </AppText>
                <AppText style={styles.rowMeta}>
                  Updated {new Date(item.updatedAt).toLocaleString('de-DE')}
                </AppText>
              </View>
            </Pressable>
          )}
          />
        </View>

        <PrimaryButton label="Refresh" onPress={load} />
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
    color: colorRoles.emptyStateDescription,
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
    gap: spacing.sm,
    flexGrow: 1,
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
