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
import type { VenueRecord } from '@/data/types/records';
import { venueService } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { canCreateVenues } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { formatVenueAddressSummary } from '@/features/venues/domain/venue-duplicate';

export default function AdminVenuesScreen() {
  const router = useRouter();
  const { role } = useAdminAuth();
  const [venues, setVenues] = useState<VenueRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await venueService.listForAdmin(role, {
        query,
        sortBy: 'name',
        page: 1,
        pageSize: 100,
      });
      setVenues(result.items);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [query, role]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading && venues.length === 0) {
    return <AdminLoadingState label="Loading venues…" />;
  }

  if (error && venues.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Back" onPress={() => router.back()} />
          <AppText style={styles.title}>Venues</AppText>
          {canCreateVenues(role) ? (
            <PrimaryButton label="Create" onPress={() => router.push('/admin/venues/new' as '/admin/events/new')} />
          ) : null}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search venues…"
          placeholderTextColor={colorRoles.emptyStateDescription}
          style={styles.search}
        />

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        {venues.length === 0 ? (
          <AdminEmptyState
            title="No venues found"
            description="Create a venue or adjust your search."
          />
        ) : (
          <FlatList
            data={venues}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/admin/venues/${item.id}` as `/admin/events/${string}`)}
                style={styles.card}
              >
                <AppText style={styles.cardTitle}>{item.name}</AppText>
                <AppText style={styles.meta}>
                  {item.city}, {item.country}
                </AppText>
                <AppText style={styles.meta}>{formatVenueAddressSummary(item)}</AppText>
                {item.capacity ? (
                  <AppText style={styles.meta}>Capacity: {item.capacity}</AppText>
                ) : null}
              </Pressable>
            )}
          />
        )}
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...textRoles.screenTitle,
    flex: 1,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  cardTitle: {
    ...textRoles.cardTitle,
  },
  meta: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  error: {
    ...textRoles.body,
    color: colorRoles.error,
  },
});
