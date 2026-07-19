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
import type { ImportRecordSummary } from '@/features/import/models/types';
import { importAdminRepository } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { useAdminRole } from '@/features/import/admin/use-admin-role';

export default function ReviewQueueScreen() {
  const router = useRouter();
  const { session } = useAdminRole();
  const [records, setRecords] = useState<ImportRecordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await importAdminRepository.listRecords({
        page: 1,
        pageSize: 50,
        sortBy: 'newest',
      });
      setRecords(result.items as ImportRecordSummary[]);
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

  if (loading && records.length === 0) {
    return <AdminLoadingState label="Loading review queue…" />;
  }

  if (error && records.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Back" onPress={() => router.back()} />
          <AppText style={styles.title}>Review Queue</AppText>
        </View>
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <AdminEmptyState
              title="Review queue is empty"
              description="No records need review right now."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/admin/imports/review/${item.id}`)}
            >
              <AppText style={styles.rowTitle}>{item.title ?? item.externalId}</AppText>
              <AppText style={styles.meta}>
                {item.eventDate ? new Date(item.eventDate).toLocaleDateString() : '—'} ·{' '}
                {item.cityName ?? '—'} · {item.venueName ?? '—'}
              </AppText>
              <AppText style={styles.meta}>
                {item.sourceName ?? item.sourceId} · Status: {item.status} · Warnings:{' '}
                {item.warningCount}
              </AppText>
              {item.duplicateScore !== undefined && item.duplicateScore > 0 ? (
                <AppText style={styles.dup}>
                  Duplicate score: {Math.round(item.duplicateScore)}%
                </AppText>
              ) : null}
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
  rowTitle: { ...textRoles.sectionTitle },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  dup: { ...textRoles.metadata, color: colors.warning },
});
