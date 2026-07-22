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
import type { OrganizerRecord } from '@/data/types/records';
import { organizerService } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { canCreateOrganizers } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';

export default function AdminOrganizersScreen() {
  const router = useRouter();
  const { role } = useAdminAuth();
  const [organizers, setOrganizers] = useState<OrganizerRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await organizerService.listForAdmin(role, {
        query,
        sortBy: 'name',
        page: 1,
        pageSize: 100,
      });
      setOrganizers(result.items);
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

  if (loading && organizers.length === 0) {
    return <AdminLoadingState label="Loading organizers…" />;
  }

  if (error && organizers.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <View style={styles.header}>
          <SecondaryButton label="Back" onPress={() => router.back()} />
          <AppText style={styles.title}>Organizers</AppText>
          {canCreateOrganizers(role) ? (
            <PrimaryButton
              label="Create"
              onPress={() => router.push('/admin/organizers/new' as '/admin/events/new')}
            />
          ) : null}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search organizers…"
          placeholderTextColor={colorRoles.emptyStateDescription}
          style={styles.search}
        />

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        {organizers.length === 0 ? (
          <AdminEmptyState
            title="No organizers found"
            description="Create an organizer or adjust your search."
          />
        ) : (
          <FlatList
            data={organizers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push(`/admin/organizers/${item.id}` as `/admin/events/${string}`)
                }
                style={styles.card}
              >
                <AppText style={styles.cardTitle}>{item.name}</AppText>
                {item.city || item.country ? (
                  <AppText style={styles.meta}>
                    {[item.city, item.country].filter(Boolean).join(', ')}
                  </AppText>
                ) : null}
                {item.website ? <AppText style={styles.meta}>{item.website}</AppText> : null}
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
    color: colors.live,
  },
});
