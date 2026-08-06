import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { FilterChip } from '@/features/home/components/FilterChip';
import {
  BILLING_RELATIONS,
  billingRelationLabel,
  formatLineupEntryDisplay,
  type BillingRelation,
  type ResolvedCanonicalLineupEntry,
} from '@/features/aggregation/domain/canonical-lineup-entry';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface StructuredLineupDraftEntry extends ResolvedCanonicalLineupEntry {}

interface StructuredLineupAdminSectionProps {
  entries: StructuredLineupDraftEntry[];
  editable: boolean;
  onChange: (entries: StructuredLineupDraftEntry[]) => void;
}

export function StructuredLineupAdminSection({
  entries,
  editable,
  onChange,
}: StructuredLineupAdminSectionProps) {
  const updateBillingRelation = (index: number, billingRelation: BillingRelation) => {
    if (!editable) {
      return;
    }
    onChange(
      entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, billingRelation } : entry,
      ),
    );
  };

  const moveEntry = (index: number, direction: -1 | 1) => {
    if (!editable) {
      return;
    }
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= entries.length) {
      return;
    }
    const next = [...entries];
    const [moved] = next.splice(index, 1);
    if (!moved) {
      return;
    }
    next.splice(targetIndex, 0, moved);
    onChange(next.map((entry, order) => ({ ...entry, order })));
  };

  if (entries.length === 0) {
    return (
      <View style={styles.container}>
        <AppText style={styles.section}>Structured Lineup</AppText>
        <AppText style={styles.meta}>No structured lineup entries stored yet.</AppText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppText style={styles.section}>Structured Lineup</AppText>
      {entries.map((entry, index) => (
        <View key={`${entry.order}-${entry.artists.join('-')}`} style={styles.row}>
          <View style={styles.rowHeader}>
            <AppText style={styles.entryTitle}>
              {index + 1}. {formatLineupEntryDisplay(entry) || '—'}
            </AppText>
            {editable ? (
              <View style={styles.actions}>
                <FilterChip
                  label="↑"
                  selected={false}
                  onPress={() => moveEntry(index, -1)}
                />
                <FilterChip
                  label="↓"
                  selected={false}
                  onPress={() => moveEntry(index, 1)}
                />
              </View>
            ) : null}
          </View>
          <AppText style={styles.meta}>
            Artists: {entry.artists.join(', ') || '—'}
            {entry.stage ? ` · Stage: ${entry.stage}` : ''}
            {entry.startTime ? ` · ${entry.startTime}` : ''}
            {entry.endTime ? `–${entry.endTime}` : ''}
            {entry.runningOrder !== undefined ? ` · Order ${entry.runningOrder}` : ''}
            {entry.confidence !== undefined ? ` · Confidence ${entry.confidence}` : ''}
          </AppText>
          {entry.provenance?.source ? (
            <AppText style={styles.meta}>Provenance: {String(entry.provenance.source)}</AppText>
          ) : null}
          <View style={styles.chips}>
            {BILLING_RELATIONS.map((relation) => (
              <FilterChip
                key={relation}
                label={relation === 'SOLO' ? 'SOLO' : billingRelationLabel(relation) || relation}
                selected={entry.billingRelation === relation}
                onPress={
                  editable ? () => updateBillingRelation(index, relation) : () => undefined
                }
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  section: {
    ...textRoles.sectionTitle,
    marginTop: spacing.sm,
  },
  row: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  entryTitle: {
    ...textRoles.cardTitle,
    flex: 1,
  },
  meta: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
