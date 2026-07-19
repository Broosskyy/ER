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
import type { ImportSource } from '@/features/import/models/types';
import { importOperationsService } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { useAdminRole } from '@/features/import/admin/use-admin-role';

export default function ImportSourcesScreen() {
  const router = useRouter();
  const { session, can } = useAdminRole();
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSources(await importOperationsService.listSources(session));
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

  const handleToggleActive = async (source: ImportSource) => {
    if (!session || !can('sources:write')) return;
    setActionId(source.id);
    try {
      await importOperationsService.setSourceActive(session, source.id, !source.active);
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActionId(null);
    }
  };

  const handleStartImport = async (source: ImportSource) => {
    if (!session || !can('imports:start')) return;
    setActionId(source.id);
    try {
      const job = await importOperationsService.startManualImport(session, source.id);
      router.push(`/admin/imports/jobs/${job.id}`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActionId(null);
    }
  };

  if (loading && sources.length === 0) {
    return <AdminLoadingState label="Loading sources…" />;
  }

  if (error && sources.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Back" onPress={() => router.back()} />
          <AppText style={styles.title}>Sources</AppText>
          {can('sources:write') ? (
            <PrimaryButton
              label="New"
              onPress={() => router.push('/admin/imports/sources/new')}
            />
          ) : null}
        </View>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        <FlatList
          data={sources}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <AdminEmptyState
              title="No sources yet"
              description="Create a source to start importing events."
              actionLabel={can('sources:write') ? 'Create Source' : undefined}
              onAction={
                can('sources:write')
                  ? () => router.push('/admin/imports/sources/new')
                  : undefined
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/admin/imports/sources/${item.id}`)}
            >
              <View style={styles.rowHeader}>
                <AppText style={styles.rowTitle}>{item.name}</AppText>
                <AppText style={item.active ? styles.badge : styles.badgeInactive}>
                  {item.active ? 'Active' : 'Inactive'}
                </AppText>
              </View>
              <AppText style={styles.meta}>
                {item.adapterKey ?? '—'} · Trust {item.trustScore}
              </AppText>
              <AppText style={styles.meta}>
                Last import: {item.lastImportAt ? new Date(item.lastImportAt).toLocaleString() : '—'}
              </AppText>
              <View style={styles.actions}>
                {can('sources:write') ? (
                  <SecondaryButton
                    label={item.active ? 'Deactivate' : 'Activate'}
                    onPress={() => handleToggleActive(item)}
                    disabled={actionId === item.id}
                  />
                ) : null}
                {can('imports:start') ? (
                  <PrimaryButton
                    label="Import"
                    onPress={() => handleStartImport(item)}
                    disabled={actionId === item.id || !item.active}
                  />
                ) : null}
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
    gap: spacing.sm,
    padding: spacingRoles.screenHorizontal,
  },
  title: { ...textRoles.screenTitle, flex: 1 },
  list: { padding: spacingRoles.screenHorizontal, gap: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { ...textRoles.sectionTitle, flex: 1 },
  badge: {
    ...textRoles.metadata,
    color: colors.primary,
    backgroundColor: colorRoles.chipBackground,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeInactive: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    backgroundColor: colorRoles.chipBackground,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  error: { ...textRoles.metadata, color: colors.live, paddingHorizontal: spacingRoles.screenHorizontal },
});
