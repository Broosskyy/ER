import { StyleSheet, View, ViewStyle } from 'react-native';

import { FilterChip } from '@/components/discovery/FilterChip';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { OrganizerMetricCard } from './OrganizerDashboard';
import type { StatisticBreakdownViewModel, StatisticPeriod, StatisticTrendViewModel, StatisticViewModel } from './view-models';

export interface StatisticSummaryCardProps {
  statistic: StatisticViewModel;
  style?: ViewStyle;
  testID?: string;
}

/** Reuses OrganizerMetricCard — mockup 34 summary metrics. */
export function StatisticSummaryCard({ statistic, style, testID }: StatisticSummaryCardProps) {
  return (
    <OrganizerMetricCard
      metric={{
        id: statistic.id,
        kind: 'views',
        label: statistic.label,
        valueLabel: statistic.valueLabel,
        changeLabel: statistic.changeLabel,
        changeDirection: statistic.changeDirection,
        icon: statistic.icon,
        accessibilityLabel: statistic.accessibilityLabel,
      }}
      style={style}
      testID={testID}
    />
  );
}

export interface StatisticTrendBlockProps {
  trend: StatisticTrendViewModel;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 34 static bar trend — no chart library. */
export function StatisticTrendBlock({ trend, style, testID }: StatisticTrendBlockProps) {
  const { theme } = useTheme();
  const maxValue = Math.max(...trend.points.map((point) => point.value), 1);

  return (
    <View style={[styles.trend, style]} testID={testID} accessibilityLabel={trend.accessibilityLabel}>
      <View style={styles.trendHeader}>
        <AppText role="sectionTitle">{trend.title}</AppText>
        <AppText role="caption" color={theme.colors.textSecondary}>{trend.periodLabel}</AppText>
      </View>
      <AppText role="titleLarge">{trend.valueLabel}</AppText>
      {trend.changeLabel ? (
        <AppText role="caption" color={theme.colors.success}>{trend.changeLabel}</AppText>
      ) : null}
      <View style={styles.bars}>
        {trend.points.map((point) => (
          <View key={point.label} style={styles.barColumn}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(8, (point.value / maxValue) * 80),
                  backgroundColor: theme.colors.accent,
                },
              ]}
            />
            <AppText role="caption" color={theme.colors.textSecondary} numberOfLines={1}>
              {point.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

export interface StatisticBreakdownRowProps {
  row: StatisticBreakdownViewModel;
  style?: ViewStyle;
  testID?: string;
}

export function StatisticBreakdownRow({ row, style, testID }: StatisticBreakdownRowProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.breakdown, style]} testID={testID} accessibilityLabel={row.accessibilityLabel}>
      <AppText role="bodyStrong" style={styles.breakdownLabel}>{row.label}</AppText>
      <AppText role="body">{row.valueLabel}</AppText>
      {row.shareLabel ? (
        <AppText role="caption" color={theme.colors.textSecondary}>{row.shareLabel}</AppText>
      ) : null}
    </View>
  );
}

const PERIOD_LABELS: Record<StatisticPeriod, string> = {
  '7d': '7 Tage',
  '30d': '30 Tage',
  '90d': '90 Tage',
  custom: 'Benutzerdefiniert',
};

export interface StatisticPeriodSelectorProps {
  periods: StatisticPeriod[];
  selected: StatisticPeriod;
  onSelect?: (period: StatisticPeriod) => void;
  style?: ViewStyle;
  testID?: string;
}

export function StatisticPeriodSelector({ periods, selected, onSelect, style, testID }: StatisticPeriodSelectorProps) {
  return (
    <Stack direction="horizontal" gap="sm" style={[styles.periods, style]} testID={testID}>
      {periods.map((period) => (
        <FilterChip
          key={period}
          label={PERIOD_LABELS[period]}
          selected={period === selected}
          onPress={() => onSelect?.(period)}
        />
      ))}
    </Stack>
  );
}

export interface StatisticEmptyStateProps {
  style?: ViewStyle;
  testID?: string;
}

export function StatisticEmptyState({ style, testID }: StatisticEmptyStateProps) {
  return (
    <EmptyState
      title="Noch keine Statistiken"
      description="Sobald deine Events Aufrufe erhalten, erscheinen hier Performance-Daten."
      icon="bar-chart-outline"
      style={style}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  trend: { gap: spacing.md },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, minHeight: 100 },
  barColumn: { flex: 1, alignItems: 'center', gap: spacing.xs },
  bar: { width: '70%', borderRadius: 4, minHeight: 8 },
  breakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  breakdownLabel: { flex: 1 },
  periods: { flexWrap: 'wrap' },
});
