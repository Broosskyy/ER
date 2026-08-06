import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { getErrorMessage } from '@/core/errors/app-error';
import { sourceEventsAdminService } from '@/data/repositories/registry';
import type { SourceEventListItem } from '@/features/admin/services/source-events-admin-service';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

interface SourceEventsSectionProps {
  sourceId: string;
  sourceName: string;
}

export function SourceEventsSection({ sourceId, sourceName }: SourceEventsSectionProps) {
  const router = useRouter();
  const [items, setItems] = useState<SourceEventListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sourceEventsAdminService.listEventsForSource(sourceId, 1, 20);
      setItems(result.items);
      setTotal(result.total);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText style={styles.sectionTitle}>Events ({total})</AppText>
        <SecondaryButton
          label="Alle anzeigen"
          onPress={() =>
            router.push(`/admin/events?sourceId=${encodeURIComponent(sourceId)}` as '/admin/events')
          }
        />
      </View>
      <AppText style={styles.hint}>
        Canonical Events mit Origin von {sourceName}. Dedupliziert pro Event.
      </AppText>
      {loading ? <AppText style={styles.meta}>Events werden geladen…</AppText> : null}
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      {!loading && items.length === 0 ? (
        <AppText style={styles.meta}>Keine veröffentlichten Events für diese Quelle.</AppText>
      ) : null}
      {items.map((item) => (
        <Pressable
          key={item.event.id}
          style={styles.row}
          onPress={() => router.push(`/admin/events/${item.event.id}`)}
        >
          <AppText style={styles.rowTitle}>{item.event.title}</AppText>
          <AppText style={styles.meta}>
            {new Date(item.event.startDate).toLocaleString('de-DE')} · {item.event.status}
            {item.isPrimarySource ? ' · Primärquelle' : ' · Origin'}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: { ...textRoles.sectionTitle },
  hint: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  error: { ...textRoles.body, color: colors.live },
  row: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  rowTitle: { ...textRoles.body, fontWeight: '600' },
});
