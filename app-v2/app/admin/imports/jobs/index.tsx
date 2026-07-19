import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { ImportJob } from '@/features/import/models/types';
import { importAdminRepository } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { formatJobDuration, shortId } from '@/features/import/admin/import-utils';
import { useAdminRole } from '@/features/import/admin/use-admin-role';

export default function ImportJobsScreen() {
  const router = useRouter();
  const { session } = useAdminRole();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await importAdminRepository.listJobs({ page: 1, pageSize: 50, sortBy: 'newest' });
      setJobs(result.items);
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

  if (loading && jobs.length === 0) {
    return <AdminLoadingState label="Loading import jobs…" />;
  }

  if (error && jobs.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Back" onPress={() => router.back()} />
          <AppText style={styles.title}>Import Jobs</AppText>
        </View>
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <AdminEmptyState
              title="No import jobs"
              description="No jobs found for the selected period."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/admin/imports/jobs/${item.id}`)}
            >
              <View style={styles.rowHeader}>
                <AppText style={styles.rowTitle}>{shortId(item.id)}</AppText>
                <AppText style={styles.badge}>{item.status}</AppText>
              </View>
              <AppText style={styles.meta}>
                {item.triggerType} · {item.startedAt ? new Date(item.startedAt).toLocaleString() : '—'}
              </AppText>
              <AppText style={styles.meta}>
                Duration: {formatJobDuration(item.startedAt, item.finishedAt)} · Fetched:{' '}
                {item.metrics.fetchedCount} · Errors: {item.metrics.errorCount}
              </AppText>
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
    gap: spacing.sm,
    padding: spacingRoles.screenHorizontal,
  },
  title: { ...textRoles.screenTitle, flex: 1 },
  list: { padding: spacingRoles.screenHorizontal },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  rowTitle: { ...textRoles.sectionTitle },
  badge: { ...textRoles.metadata, color: colors.primary },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
});
