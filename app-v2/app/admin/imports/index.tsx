import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { ImportMonitoringStats } from '@/features/import/models/types';
import { importAdminRepository, importOperationsService } from '@/data/repositories/registry';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { useAdminRole } from '@/features/import/admin/use-admin-role';
import { formatJobDuration } from '@/features/import/admin/import-utils';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

export default function ImportDashboardScreen() {
  const router = useRouter();
  const { session } = useAdminRole();
  const [stats, setStats] = useState<ImportMonitoringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await importOperationsService.getMonitoringStats(session));
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

  if (loading) return <AdminLoadingState label="Loading import dashboard…" />;
  if (error || !stats) {
    return <AdminErrorState message={error ?? 'Unable to load import dashboard.'} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>Imports</AppText>
          </View>

          <View style={styles.grid}>
            <StatCard label="Active Sources" value={stats.activeSources} />
            <StatCard label="Failed Jobs (24h)" value={stats.failedJobsLast24h} />
            <StatCard label="In Review" value={stats.recordsInReview} />
            <StatCard label="Invalid" value={stats.invalidRecords} />
            <StatCard label="Duplicates" value={stats.duplicateCandidates} />
            <StatCard
              label="Avg Job Duration"
              value={formatJobDuration(
                new Date(0).toISOString(),
                new Date(stats.averageJobDurationMs).toISOString(),
              )}
            />
          </View>

          <PrimaryButton label="Sources" onPress={() => router.push('/admin/imports/sources')} />
          <PrimaryButton label="Import Jobs" onPress={() => router.push('/admin/imports/jobs')} />
          <PrimaryButton label="Review Queue" onPress={() => router.push('/admin/imports/review')} />

          {stats.lastSuccessfulImports.length > 0 ? (
            <View style={styles.section}>
              <AppText style={styles.sectionTitle}>Recent Successful Imports</AppText>
              {stats.lastSuccessfulImports.map((entry) => (
                <Pressable
                  key={entry.jobId}
                  style={styles.row}
                  onPress={() => router.push(`/admin/imports/jobs/${entry.jobId}`)}
                >
                  <AppText style={styles.rowTitle}>{entry.sourceName}</AppText>
                  <AppText style={styles.rowMeta}>
                    {new Date(entry.finishedAt).toLocaleString()}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacingRoles.screenHorizontal, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...textRoles.screenTitle, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statValue: { ...textRoles.screenTitle, fontSize: 24 },
  statLabel: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  section: { gap: spacing.sm },
  sectionTitle: { ...textRoles.sectionTitle },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowTitle: { ...textRoles.body },
  rowMeta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
});
