import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { ArtistRecord } from '@/data/types/records';
import { artistService } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canCreateArtists } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import type { ArtistLifecycleStatus } from '@/features/artists/types/artist-status';

const STATUS_FILTERS: Array<ArtistLifecycleStatus | 'all'> = [
  'all',
  'draft',
  'published',
  'archived',
];

export default function AdminArtistsScreen() {
  const router = useRouter();
  const { role } = useAdminAuth();
  const [artists, setArtists] = useState<ArtistRecord[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ArtistLifecycleStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await artistService.listForAdmin(role, {
        query,
        status,
        sortBy: 'updated',
        page: 1,
        pageSize: 100,
      });
      setArtists(result.items);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [query, role, status]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading && artists.length === 0) {
    return <AdminLoadingState label="Loading artists…" />;
  }

  if (error && artists.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Back" onPress={() => router.back()} />
          <AppText style={styles.title}>Artists</AppText>
          {canCreateArtists(role) ? (
            <PrimaryButton label="New" onPress={() => router.push('/admin/artists/new' as '/admin/events/new')} />
          ) : null}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search artists…"
          placeholderTextColor={colorRoles.emptyStateDescription}
          style={styles.search}
        />

        <View style={styles.filters}>
          {STATUS_FILTERS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setStatus(item)}
              style={[styles.filterChip, status === item && styles.filterChipActive]}
            >
              <AppText style={status === item ? styles.filterTextActive : styles.filterText}>
                {item}
              </AppText>
            </Pressable>
          ))}
        </View>

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        {artists.length === 0 ? (
          <AdminEmptyState
            title="No artists yet"
            description="Create the first canonical artist profile for Eternal Rave."
          />
        ) : (
          <View style={adminPageLayoutStyles.listRegion}>
            <FlatList
              style={adminPageLayoutStyles.flexScroll}
              data={artists}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/admin/artists/${item.id}` as `/admin/events/${string}`)}
              >
                <View style={styles.rowMain}>
                  <AppText style={styles.rowTitle}>{item.name}</AppText>
                  <AppText style={styles.rowMeta}>
                    {item.status} · {item.verificationStatus}
                    {item.genreIds.length > 0 ? ` · ${item.genreIds.length} genre(s)` : ''}
                  </AppText>
                </View>
                <AppText style={styles.rowDate}>
                  {new Date(item.updatedAt).toLocaleDateString()}
                </AppText>
              </Pressable>
            )}
            />
          </View>
        )}
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...textRoles.sectionTitle,
    flex: 1,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  filterText: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    textTransform: 'capitalize',
  },
  filterTextActive: {
    ...textRoles.metadata,
    color: colors.textPrimary,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacingRoles.screenHorizontal,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    ...textRoles.cardTitle,
  },
  rowMeta: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    textTransform: 'capitalize',
  },
  rowDate: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
});
