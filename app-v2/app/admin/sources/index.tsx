import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { SourceListParams, SourceRecord } from '@/data/types/records';
import { sourceService } from '@/data/repositories/registry';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { canManageSources } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import {
  PARSER_TYPES,
  SOURCE_TYPES,
} from '@/features/sources/domain/source-types';
import {
  formatAcquisitionStrategyLabel,
  formatParserTypeLabel,
  formatSourceStatus,
  formatSourceTypeLabel,
} from '@/features/sources/admin/source-labels';

type StatusFilter = 'all' | 'enabled' | 'disabled' | 'archived';

export default function AdminSourcesScreen() {
  const router = useRouter();
  const { role } = useAdminAuth();
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [parserFilter, setParserFilter] = useState<string>('all');
  const [authFilter, setAuthFilter] = useState<'all' | 'required' | 'none'>('all');
  const [sortBy, setSortBy] = useState<NonNullable<SourceListParams['sortBy']>>('priority');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listParams = useMemo((): SourceListParams => {
    const params: SourceListParams = {
      query,
      sortBy,
      page: 1,
      pageSize: 100,
    };

    if (statusFilter === 'enabled') {
      params.enabled = true;
      params.archived = false;
    } else if (statusFilter === 'disabled') {
      params.enabled = false;
      params.archived = false;
    } else if (statusFilter === 'archived') {
      params.archived = true;
    }

    if (sourceTypeFilter !== 'all') {
      params.sourceType = sourceTypeFilter as SourceListParams['sourceType'];
    }

    if (parserFilter !== 'all') {
      params.parserType = parserFilter as SourceListParams['parserType'];
    }

    if (authFilter === 'required') {
      params.requiresAuthentication = true;
    } else if (authFilter === 'none') {
      params.requiresAuthentication = false;
    }

    return params;
  }, [authFilter, parserFilter, query, sortBy, sourceTypeFilter, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sourceService.listForAdmin(role, listParams);
      setSources(result.items);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [listParams, role]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timeout);
  }, [load]);

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
          {canManageSources(role) ? (
            <PrimaryButton
              label="Create"
              onPress={() => router.push('/admin/sources/new' as '/admin/events/new')}
            />
          ) : null}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, slug, URL, type…"
          placeholderTextColor={colorRoles.emptyStateDescription}
          style={styles.search}
          accessibilityLabel="Search sources"
        />

        <View style={styles.filterRow}>
          {(['all', 'enabled', 'disabled', 'archived'] as StatusFilter[]).map((filter) => (
            <SecondaryButton
              key={filter}
              label={filter}
              onPress={() => setStatusFilter(filter)}
              style={statusFilter === filter ? styles.chipActive : undefined}
            />
          ))}
        </View>

        <View style={styles.filterRow}>
          <SecondaryButton
            label={`Sort: ${sortBy}`}
            onPress={() => {
              const options: NonNullable<SourceListParams['sortBy']>[] = [
                'priority',
                'trustScore',
                'displayName',
                'sourceType',
                'updated',
                'created',
              ];
              const index = options.indexOf(sortBy);
              const next = options[(index + 1) % options.length] ?? 'priority';
              setSortBy(next);
            }}
          />
        </View>

        <View style={styles.filterRow}>
          {['all', ...SOURCE_TYPES.slice(0, 4)].map((type) => (
            <SecondaryButton
              key={type}
              label={type === 'all' ? 'All types' : formatSourceTypeLabel(type)}
              onPress={() => setSourceTypeFilter(type)}
              style={sourceTypeFilter === type ? styles.chipActive : undefined}
            />
          ))}
        </View>

        <View style={styles.filterRow}>
          {['all', ...PARSER_TYPES.slice(0, 4)].map((type) => (
            <SecondaryButton
              key={type}
              label={type === 'all' ? 'All parsers' : formatParserTypeLabel(type)}
              onPress={() => setParserFilter(type)}
              style={parserFilter === type ? styles.chipActive : undefined}
            />
          ))}
        </View>

        <View style={styles.filterRow}>
          {(['all', 'required', 'none'] as const).map((filter) => (
            <SecondaryButton
              key={filter}
              label={filter === 'all' ? 'Any auth' : filter === 'required' ? 'Auth required' : 'No auth'}
              onPress={() => setAuthFilter(filter)}
              style={authFilter === filter ? styles.chipActive : undefined}
            />
          ))}
        </View>

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        {sources.length === 0 ? (
          <AdminEmptyState
            title="No sources found"
            description="Create a source or adjust your filters."
          />
        ) : (
          <FlatList
            data={sources}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push(`/admin/sources/${item.id}` as `/admin/events/${string}`)
                }
                style={styles.card}
                accessibilityRole="button"
              >
                <View style={styles.cardHeader}>
                  <AppText style={styles.cardTitle}>{item.displayName}</AppText>
                  <AppText style={styles.badge}>{formatSourceStatus(item.enabled, item.archived)}</AppText>
                </View>
                <AppText style={styles.meta}>
                  {formatSourceTypeLabel(item.sourceType)} · {formatParserTypeLabel(item.parserType)} ·{' '}
                  {formatAcquisitionStrategyLabel(item.acquisitionStrategy)}
                </AppText>
                <AppText style={styles.meta}>{item.baseUrl ?? 'No base URL'}</AppText>
                <AppText style={styles.meta}>
                  Priority {item.priority} · Trust {item.trustScore}
                  {item.pollingStrategy ? ` · Poll ${item.pollingStrategy}` : ''}
                </AppText>
                <AppText style={styles.meta}>
                  Updated {new Date(item.updatedAt).toLocaleString()}
                </AppText>
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipActive: {
    borderColor: colors.primary,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...textRoles.cardTitle,
    flex: 1,
  },
  badge: {
    ...textRoles.metadata,
    color: colors.primary,
    backgroundColor: colorRoles.chipBackground,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    textTransform: 'capitalize',
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
