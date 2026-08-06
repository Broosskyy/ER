import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EventSourceCard } from '@/components/admin/SourceDuplicateComponents';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { SourceListParams, SourceRecord } from '@/data/types/records';
import { sourceService } from '@/data/repositories/registry';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canManageSources } from '@/features/admin/admin-permissions';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import { mapSourceRecordToViewModel } from '@/features/admin/utils/admin-review-mapper';
import {
  PARSER_TYPES,
  SOURCE_TYPES,
} from '@/features/sources/domain/source-types';
import {
  formatParserTypeLabel,
  formatSourceTypeLabel,
} from '@/features/sources/admin/source-labels';
import { PlatformDiscoveryPanel } from '@/features/ticket-platform-discovery/admin/PlatformDiscoveryPanel';

type StatusFilter = 'all' | 'enabled' | 'disabled' | 'archived';

export function AdminSourcesContent() {
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
    return <AdminLoadingState label="Quellen werden geladen…" />;
  }

  if (error && sources.length === 0) {
    return <AdminErrorState message={error} onRetry={load} />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Zurück" onPress={() => router.back()} />
            <AppText role="screenTitle" style={styles.title}>Quellen</AppText>
            {canManageSources(role) ? (
              <PrimaryButton
                label="Erstellen"
                onPress={() => router.push('/admin/sources/new' as '/admin/events/new')}
              />
            ) : null}
          </View>

          {canManageSources(role) ? <PlatformDiscoveryPanel role={role} /> : null}

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, Slug, URL oder Typ suchen…"
            placeholderTextColor={colorRoles.emptyStateDescription}
            style={styles.search}
            accessibilityLabel="Quellen suchen"
          />

          <View style={styles.filterRow}>
            {(['all', 'enabled', 'disabled', 'archived'] as StatusFilter[]).map((filter) => (
              <SecondaryButton
                key={filter}
                label={
                  filter === 'all'
                    ? 'Alle'
                    : filter === 'enabled'
                      ? 'Aktiv'
                      : filter === 'disabled'
                        ? 'Inaktiv'
                        : 'Archiviert'
                }
                onPress={() => setStatusFilter(filter)}
                style={statusFilter === filter ? styles.chipActive : undefined}
              />
            ))}
          </View>

          <View style={styles.filterRow}>
            <SecondaryButton
              label={`Sortierung: ${sortBy}`}
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
                label={type === 'all' ? 'Alle Typen' : formatSourceTypeLabel(type)}
                onPress={() => setSourceTypeFilter(type)}
                style={sourceTypeFilter === type ? styles.chipActive : undefined}
              />
            ))}
          </View>

          <View style={styles.filterRow}>
            {['all', ...PARSER_TYPES.slice(0, 4)].map((type) => (
              <SecondaryButton
                key={type}
                label={type === 'all' ? 'Alle Parser' : formatParserTypeLabel(type)}
                onPress={() => setParserFilter(type)}
                style={parserFilter === type ? styles.chipActive : undefined}
              />
            ))}
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}

          {sources.length === 0 ? (
            <AdminEmptyState
              title="Keine Quellen gefunden"
              description="Lege eine neue Quelle an oder passe die Filter an."
            />
          ) : (
            <View style={styles.list}>
              {sources.map((item) => (
                <EventSourceCard
                  key={item.id}
                  source={mapSourceRecordToViewModel(item)}
                  onConfigurePress={() =>
                    router.push(`/admin/sources/${item.id}` as `/admin/events/${string}`)
                  }
                  onViewEventsPress={() =>
                    router.push(
                      `/admin/events?sourceId=${encodeURIComponent(item.id)}` as '/admin/events',
                    )
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
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
    gap: spacing.md,
  },
  error: {
    ...textRoles.body,
    color: colors.live,
  },
});
