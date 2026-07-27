import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import {
  AdminDashboardHeader,
  AdminMetricGrid,
  AdminQueueTabs,
} from '@/components/admin/AdminDashboardComponents';
import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import { getErrorMessage } from '@/core/errors/app-error';
import { adminEventModerationService, sourceService } from '@/data/repositories/registry';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canViewContributorReviewQueue, canViewSources } from '@/features/admin/admin-permissions';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import type { ModerationQueueStatus } from '@/features/admin/types/moderation-types';
import {
  buildAdminDashboardMetrics,
  buildAdminQueueTabs,
} from '@/features/admin/utils/admin-review-mapper';
import { useAdminRole } from '@/features/import/admin/use-admin-role';

export function AdminDashboardContent() {
  const router = useRouter();
  const { session } = useAdminAuth();
  const { role } = useAdminRole();
  const [counts, setCounts] = useState<Record<ModerationQueueStatus, number> | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardCounts, sources] = await Promise.all([
        adminEventModerationService.getDashboardCounts(session),
        canViewSources(role)
          ? sourceService.listForAdmin(role, { page: 1, pageSize: 1 })
          : Promise.resolve({ total: 0, items: [] }),
      ]);
      setCounts(dashboardCounts);
      setSourceCount(sources.total);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [role, session]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading) {
    return <AdminLoadingState label="Dashboard wird geladen…" />;
  }

  if (error || !counts) {
    return <AdminErrorState message={error ?? 'Dashboard konnte nicht geladen werden.'} onRetry={load} />;
  }

  const metrics = buildAdminDashboardMetrics(counts);

  return (
    <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
      <AdminDashboardHeader
        title="Moderation"
        description="Übersicht über eingereichte Events, Prüfstatus und Quellen."
        primaryActionLabel="Einreichungen öffnen"
        onPrimaryAction={() => router.push('/admin/events/review')}
      />

      <AdminMetricGrid metrics={metrics} />

      <View style={styles.section}>
        <AppText role="sectionTitle">Warteschlangen</AppText>
        <AdminQueueTabs
          tabs={buildAdminQueueTabs(counts, 'all')}
          onTabPress={() => router.push('/admin/events/review')}
        />
      </View>

      <View style={styles.section}>
        <AppText role="sectionTitle">Meldungen</AppText>
        <View style={styles.linkCard}>
          <AppText role="bodyStrong">Offene Meldungen</AppText>
          <AppText role="caption">0 — noch keine Meldungen im System</AppText>
        </View>
      </View>

      <View style={styles.actions}>
        {canViewContributorReviewQueue(role) ? (
          <PrimaryButton
            label={`Ausstehend (${counts.pending})`}
            onPress={() => router.push('/admin/events/review?filter=pending')}
          />
        ) : null}
        {canViewContributorReviewQueue(role) ? (
          <SecondaryButton
            label={`In Prüfung (${counts.in_review})`}
            onPress={() => router.push('/admin/events/review?filter=in_review')}
          />
        ) : null}
        {canViewContributorReviewQueue(role) ? (
          <SecondaryButton
            label={`Genehmigt (${counts.approved})`}
            onPress={() => router.push('/admin/events/review?filter=approved')}
          />
        ) : null}
        {canViewSources(role) ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/admin/sources')}
            style={styles.linkCard}
          >
            <AppText role="bodyStrong">Quellen</AppText>
            <AppText role="caption">{sourceCount} registriert</AppText>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  linkCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
});
