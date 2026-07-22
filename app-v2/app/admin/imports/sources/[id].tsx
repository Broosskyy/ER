import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { ImportSource, SourceTestResult } from '@/features/import/models/types';
import { importOperationsService } from '@/data/repositories/registry';
import { ADAPTER_KEYS } from '@/features/import/admin/import-operations-service';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { useAdminRole } from '@/features/import/admin/use-admin-role';

function createEmptySource(): ImportSource {
  return {
    id: `src-${Date.now()}`,
    name: '',
    type: 'feed',
    trustScore: 50,
    active: false,
    adapterKey: 'rss',
    reviewRequired: true,
    sourceConfig: { feed: { feedUrl: '' } },
  };
}

export default function ImportSourceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { session, can } = useAdminRole();
  const [source, setSource] = useState<ImportSource>(() => createEmptySource());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<SourceTestResult | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew || !session) return;
    setLoading(true);
    setError(null);
    try {
      const loaded = await importOperationsService.getSource(session, id);
      if (loaded) setSource(loaded);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id, isNew, session]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const handleSave = async () => {
    if (!session || !can('sources:write')) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await importOperationsService.saveSource(session, source, isNew);
      setSuccess('Source saved.');
      if (isNew) router.replace(`/admin/imports/sources/${saved.id}`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!session || !can('sources:test')) return;
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      if (isNew) {
        setError('Save the source before testing.');
        return;
      }
      const result = await importOperationsService.testSource(session, id);
      setTestResult(result);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading source…" />;
  if (error && !source.name && !isNew) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>{isNew ? 'New Source' : source.name}</AppText>
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          <AppText style={styles.label}>Name</AppText>
          <TextInput
            style={styles.input}
            value={source.name}
            onChangeText={(name) => setSource((s) => ({ ...s, name }))}
            editable={can('sources:write')}
          />

          <AppText style={styles.label}>Adapter</AppText>
          <View style={styles.chips}>
            {ADAPTER_KEYS.map((key) => (
              <SecondaryButton
                key={key}
                label={key}
                onPress={() => setSource((s) => ({ ...s, adapterKey: key }))}
                style={source.adapterKey === key ? styles.chipActive : undefined}
              />
            ))}
          </View>

          <AppText style={styles.label}>Feed / Source URL</AppText>
          <TextInput
            style={styles.input}
            value={source.sourceUrl ?? source.sourceConfig?.feed?.feedUrl ?? ''}
            onChangeText={(url) =>
              setSource((s) => ({
                ...s,
                sourceUrl: url,
                sourceConfig: { ...s.sourceConfig, feed: { ...s.sourceConfig?.feed, feedUrl: url } },
              }))
            }
            editable={can('sources:write')}
            autoCapitalize="none"
          />

          <AppText style={styles.label}>Trust Score (0–100)</AppText>
          <TextInput
            style={styles.input}
            value={String(source.trustScore)}
            keyboardType="numeric"
            onChangeText={(value) =>
              setSource((s) => ({ ...s, trustScore: Math.min(100, Math.max(0, Number(value) || 0)) }))
            }
            editable={can('sources:write')}
          />

          {can('sources:write') ? (
            <PrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
          ) : null}
          {can('sources:test') && !isNew ? (
            <SecondaryButton label={testing ? 'Testing…' : 'Test Source'} onPress={handleTest} disabled={testing} />
          ) : null}

          {testResult ? (
            <View style={styles.testBox}>
              <AppText style={styles.sectionTitle}>
                Test: {testResult.status} ({testResult.durationMs}ms)
              </AppText>
              <AppText style={styles.meta}>Records found: {testResult.recordCount}</AppText>
              {testResult.warnings.map((w) => (
                <AppText key={w} style={styles.warning}>{w}</AppText>
              ))}
              {testResult.errors.map((e) => (
                <AppText key={e} style={styles.error}>{e}</AppText>
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
  label: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    color: colors.textPrimary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipActive: { borderColor: colors.primary },
  error: { ...textRoles.metadata, color: colors.live },
  success: { ...textRoles.metadata, color: colors.primary },
  warning: { ...textRoles.metadata, color: colors.warning },
  testBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: { ...textRoles.sectionTitle },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
});
