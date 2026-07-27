import { StyleSheet, View, ViewStyle } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { SearchBar } from '@/components/inputs/SearchBar';
import { FilterChip } from '@/components/discovery/FilterChip';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { AdminMetricCard } from '@/components/organizer/OrganizerDashboard';
import type { AdminMetricViewModel, AdminQueueTabViewModel } from './view-models';

export interface AdminDashboardHeaderProps {
  title: string;
  description?: string;
  periodLabel?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onFilterPress?: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 41 admin dashboard header. */
export function AdminDashboardHeader({
  title,
  description,
  periodLabel,
  searchPlaceholder = 'Suchen…',
  searchValue,
  onSearchChange,
  onFilterPress,
  primaryActionLabel,
  onPrimaryAction,
  style,
  testID,
}: AdminDashboardHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, style]} testID={testID}>
      <AppText role="titleLarge">{title}</AppText>
      {description ? <AppText role="bodyMuted" color={theme.colors.textSecondary}>{description}</AppText> : null}
      {periodLabel ? <AppText role="caption" color={theme.colors.textSecondary}>{periodLabel}</AppText> : null}
      {onSearchChange ? (
        <SearchBar value={searchValue ?? ''} onChangeText={onSearchChange} placeholder={searchPlaceholder} />
      ) : null}
      <Stack direction="horizontal" gap="sm" style={styles.headerActions}>
        {onFilterPress ? <SecondaryButton label="Filter" onPress={onFilterPress} /> : null}
        {primaryActionLabel && onPrimaryAction ? (
          <PrimaryButton label={primaryActionLabel} onPress={onPrimaryAction} />
        ) : null}
      </Stack>
    </View>
  );
}

export interface AdminMetricGridProps {
  metrics: AdminMetricViewModel[];
  style?: ViewStyle;
  testID?: string;
}

export function AdminMetricGrid({ metrics, style, testID }: AdminMetricGridProps) {
  return (
    <View style={[styles.metricGrid, style]} testID={testID}>
      {metrics.map((metric) => (
        <View key={metric.id} style={styles.metricItem}>
          <AdminMetricCard metric={metric} />
        </View>
      ))}
    </View>
  );
}

export interface AdminQueueTabsProps {
  tabs: AdminQueueTabViewModel[];
  onTabPress?: (tabId: AdminQueueTabViewModel['id']) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 42 review queue tabs. */
export function AdminQueueTabs({ tabs, onTabPress, style, testID }: AdminQueueTabsProps) {
  return (
    <Stack direction="horizontal" gap="sm" style={[styles.tabs, style]} testID={testID}>
      {tabs.map((tab) => (
        <FilterChip
          key={tab.id}
          label={tab.count !== undefined ? `${tab.label} (${tab.count})` : tab.label}
          selected={tab.active}
          onPress={() => onTabPress?.(tab.id)}
        />
      ))}
    </Stack>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md },
  headerActions: { flexWrap: 'wrap' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricItem: { minWidth: '45%', flex: 1 },
  tabs: { flexWrap: 'wrap' },
});
