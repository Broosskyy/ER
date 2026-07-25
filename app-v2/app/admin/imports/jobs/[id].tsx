import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { ImportJob, ImportLog, ImportRecord } from '@/features/import/models/types';
import { importAdminRepository, importJobRepository } from '@/data/repositories/registry';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { formatJobDuration } from '@/features/import/admin/import-utils';

export default function ImportJobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<ImportJob | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedJob, logResult, recordResult] = await Promise.all([
        importJobRepository.getById(id),
        importAdminRepository.listLogs({ importJobId: id, page: 1, pageSize: 100 }),
        importAdminRepository.listRecords({
          importJobId: id,
          status: 'all',
          includeRawPayload: false,
          page: 1,
          pageSize: 50,
        }),
      ]);
      setJob(loadedJob);
      setLogs(logResult.items);
      setRecords(recordResult.items as ImportRecord[]);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading) return <AdminLoadingState label="Loading job…" />;
  if (error || !job) {
    return <AdminErrorState message={error ?? 'Job not found.'} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>Job Detail</AppText>
          </View>

          <View style={styles.card}>
            <AppText style={styles.label}>Status</AppText>
            <AppText style={styles.value}>{job.status}</AppText>
            <AppText style={styles.label}>Trigger</AppText>
            <AppText style={styles.value}>
              {job.triggerType}
              {job.triggeredBy ? ` · ${job.triggeredBy}` : ''}
            </AppText>
            <AppText style={styles.label}>Duration</AppText>
            <AppText style={styles.value}>
              {formatJobDuration(job.startedAt, job.finishedAt)}
            </AppText>
            {job.errorSummary ? (
              <>
                <AppText style={styles.label}>Error</AppText>
                <AppText style={styles.error}>{job.errorSummary}</AppText>
              </>
            ) : null}
          </View>

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Metrics</AppText>
            <AppText style={styles.meta}>Fetched: {job.metrics.fetchedCount}</AppText>
            <AppText style={styles.meta}>Parsed: {job.metrics.parsedCount}</AppText>
            <AppText style={styles.meta}>Invalid: {job.metrics.invalidCount}</AppText>
            <AppText style={styles.meta}>Duplicates: {job.metrics.duplicateCount}</AppText>
            <AppText style={styles.meta}>Warnings: {job.metrics.warningCount}</AppText>
            <AppText style={styles.meta}>Errors: {job.metrics.errorCount}</AppText>
          </View>

          <AppText style={styles.sectionTitle}>Logs ({logs.length})</AppText>
          <FlatList
            data={logs}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.logRow}>
                <AppText style={styles.logLevel}>{item.level}</AppText>
                <AppText style={styles.logMessage}>{item.message}</AppText>
              </View>
            )}
          />

          <AppText style={styles.sectionTitle}>Records ({records.length})</AppText>
          {records.map((record) => (
            <SecondaryButton
              key={record.id}
              label={`${record.externalId} · ${record.status}`}
              onPress={() => router.push(`/admin/imports/review/${record.id}`)}
            />
          ))}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: { ...textRoles.sectionTitle },
  label: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  value: { ...textRoles.body },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  error: { ...textRoles.metadata, color: colors.live },
  logRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logLevel: { ...textRoles.metadata, width: 60, color: colors.primary },
  logMessage: { ...textRoles.metadata, flex: 1 },
});
