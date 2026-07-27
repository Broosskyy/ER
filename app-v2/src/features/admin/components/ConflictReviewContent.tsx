import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { getErrorMessage } from '@/core/errors/app-error';
import { adminMultiSourceService } from '@/data/repositories/registry';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import type { EventConflict } from '@/features/aggregation/merge/event-conflict';

export function ConflictReviewContent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAdminAuth();
  const [conflicts, setConflicts] = useState<EventConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || !id) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const context = await adminMultiSourceService.loadDuplicateReviewContext(id);
      setConflicts(context.conflicts);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const resolve = async (
    conflict: EventConflict,
    decision: 'source_value' | 'keep_canonical' | 'manual_value' | 'defer',
    sourceId?: string,
    manualValue?: string,
  ) => {
    if (!session) {
      return;
    }
    try {
      if (decision === 'defer') {
        await adminMultiSourceService.resolveConflict({
          actorId: session.user.id,
          conflictId: conflict.id,
          decision,
        });
      } else {
        await adminMultiSourceService.resolveConflict({
          actorId: session.user.id,
          conflictId: conflict.id,
          decision,
          sourceId,
          manualValue,
        });
      }
      await load();
      setSuccess(`Konflikt ${conflict.field} bearbeitet.`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  };

  if (loading) {
    return <AdminLoadingState label="Konflikte werden geladen…" />;
  }

  if (error && conflicts.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  const unresolved = conflicts.filter((conflict) => !conflict.resolved);

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Zurück" onPress={() => router.back()} />
            <AppText style={styles.title}>Konfliktprüfung</AppText>
          </View>

          {success ? <AppText style={styles.success}>{success}</AppText> : null}
          {error ? <AppText style={styles.error}>{error}</AppText> : null}

          {unresolved.length === 0 ? (
            <AdminEmptyState
              title="Keine offenen Konflikte"
              description="Für dieses Event sind keine ungelösten Feld-Konflikte vorhanden."
            />
          ) : (
            unresolved.map((conflict) => (
              <View key={conflict.id} style={styles.card}>
                <AppText style={styles.field}>{conflict.field}</AppText>
                <AppText style={styles.meta}>
                  Schweregrad: {conflict.severity}
                  {conflict.severity === 'critical' ? ' · blockiert Veröffentlichung' : ''}
                </AppText>
                {conflict.values.map((entry) => (
                  <AppText key={`${conflict.id}-${entry.sourceId}`} style={styles.meta}>
                    {entry.sourceId}: {String(entry.value)}
                  </AppText>
                ))}
                <View style={styles.actions}>
                  {conflict.values[0] ? (
                    <SecondaryButton
                      label="Quellenwert"
                      onPress={() => void resolve(conflict, 'source_value', conflict.values[0]?.sourceId)}
                    />
                  ) : null}
                  <SecondaryButton
                    label="Canonical behalten"
                    onPress={() => void resolve(conflict, 'keep_canonical')}
                  />
                  <SecondaryButton
                    label="Manuell"
                    onPress={() => void resolve(conflict, 'manual_value', undefined, String(conflict.values[0]?.value ?? ''))}
                  />
                  <SecondaryButton
                    label="Zurückstellen"
                    onPress={() => void resolve(conflict, 'defer')}
                  />
                  {conflict.resolved ? (
                    <SecondaryButton
                      label="Wieder öffnen"
                      onPress={() => void adminMultiSourceService.reopenConflict(conflict.id, session?.user.id ?? 'admin')}
                    />
                  ) : null}
                </View>
              </View>
            ))
          )}

          <PrimaryButton label="Zurück" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacingRoles.screenHorizontal,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { ...textRoles.sectionTitle, flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  field: { ...textRoles.sectionTitle },
  meta: { ...textRoles.metadata },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  success: { ...textRoles.metadata, color: '#7dd3a8' },
  error: { ...textRoles.metadata, color: '#ff6b6b' },
});
