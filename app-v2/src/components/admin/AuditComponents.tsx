import { StyleSheet, View, ViewStyle } from 'react-native';

import { FilterChip } from '@/components/discovery/FilterChip';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { AuditLogViewModel } from './view-models';

export interface AuditLogItemProps {
  entry: AuditLogViewModel;
  style?: ViewStyle;
  testID?: string;
}

export function AuditLogItem({ entry, style, testID }: AuditLogItemProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.logItem, style]} testID={testID} accessibilityLabel={entry.accessibilityLabel}>
      <View style={[styles.logIcon, { backgroundColor: theme.colors.surfaceSubtle }]}>
        <AppIcon name={entry.icon ?? 'time-outline'} size="sm" color={theme.colors.accent} />
      </View>
      <View style={styles.logCopy}>
        <AppText role="bodyStrong">{entry.actionLabel}</AppText>
        <AppText role="caption" color={theme.colors.textSecondary}>
          {entry.actorLabel} · {entry.entityLabel}
        </AppText>
        {entry.reasonLabel ? (
          <AppText role="caption" color={theme.colors.textSecondary}>{entry.reasonLabel}</AppText>
        ) : null}
        {entry.previousStatusLabel && entry.newStatusLabel ? (
          <AppText role="caption" color={theme.colors.textSecondary}>
            {entry.previousStatusLabel} → {entry.newStatusLabel}
          </AppText>
        ) : null}
      </View>
      <AppText role="caption" color={theme.colors.textSecondary}>{entry.timestampLabel}</AppText>
    </View>
  );
}

export interface AuditLogFilterBarProps {
  filters: { id: string; label: string; active?: boolean }[];
  onFilterPress?: (filterId: string) => void;
  style?: ViewStyle;
  testID?: string;
}

export function AuditLogFilterBar({ filters, onFilterPress, style, testID }: AuditLogFilterBarProps) {
  return (
    <Stack direction="horizontal" gap="sm" style={[styles.filterBar, style]} testID={testID}>
      {filters.map((filter) => (
        <FilterChip
          key={filter.id}
          label={filter.label}
          selected={filter.active}
          onPress={() => onFilterPress?.(filter.id)}
        />
      ))}
    </Stack>
  );
}

export interface AuditEmptyStateProps {
  style?: ViewStyle;
  testID?: string;
}

export function AuditEmptyState({ style, testID }: AuditEmptyStateProps) {
  return (
    <EmptyState
      title="Keine Audit-Einträge"
      description="Änderungen an Events, Quellen und Moderationsentscheidungen erscheinen hier."
      icon="list-outline"
      style={style}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  logIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logCopy: { flex: 1, gap: spacing.xs },
  filterBar: { flexWrap: 'wrap' },
});
