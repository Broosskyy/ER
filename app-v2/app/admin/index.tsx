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
import type { DashboardStats } from '@/data/types/records';
import { statsRepository } from '@/data/repositories/registry';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { signOut } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await statsRepository.getDashboardStats());
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading) return <AdminLoadingState label="Loading dashboard…" />;
  if (error || !stats) {
    return <AdminErrorState message={error ?? 'Unable to load dashboard.'} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <AppText style={styles.title}>Admin Dashboard</AppText>
            <SecondaryButton label="Logout" onPress={signOut} />
          </View>
          <View style={styles.grid}>
            <StatCard label="Events" value={stats.events} />
            <StatCard label="Cities" value={stats.cities} />
            <StatCard label="Genres" value={stats.genres} />
            <StatCard label="Venues" value={stats.venues} />
            <StatCard label="Collections" value={stats.collections} />
          </View>
          <PrimaryButton label="Manage Events" onPress={() => router.push('/admin/events')} />
          <PrimaryButton label="Import Operations" onPress={() => router.push('/admin/imports')} />
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <AppText style={styles.backText}>Back to app</AppText>
          </Pressable>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { ...textRoles.screenTitle },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statValue: { ...textRoles.screenTitle, fontSize: 28 },
  statLabel: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  backLink: { alignSelf: 'center' },
  backText: { ...textRoles.metadata, color: colors.primary },
});
