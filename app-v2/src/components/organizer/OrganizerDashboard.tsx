import { Image, StyleSheet, View, ViewStyle } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { Badge } from '@/components/feedback/Badge';
import { Skeleton } from '@/components/feedback/Skeleton';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { VerificationBadge } from '@/components/profiles/VerificationBadge';
import { componentSize } from '@/design/layout';
import { borderWidth } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type {
  OrganizerActivityViewModel,
  OrganizerDashboardViewModel,
  OrganizerMetricViewModel,
  OrganizerQuickActionViewModel,
} from './view-models';

export interface OrganizerDashboardHeaderProps {
  dashboard: OrganizerDashboardViewModel;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 20 organizer dashboard header. */
export function OrganizerDashboardHeader({
  dashboard,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  style,
  testID,
}: OrganizerDashboardHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, style]} testID={testID} accessibilityLabel={dashboard.accessibilityLabel}>
      <View style={styles.headerRow}>
        {dashboard.logo ? (
          <Image source={dashboard.logo} style={[styles.logo, { borderColor: theme.colors.accent }]} />
        ) : (
          <View style={[styles.logo, styles.logoFallback, { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceSubtle }]}>
            <AppIcon name="business-outline" color={theme.colors.accent} />
          </View>
        )}
        <View style={styles.headerCopy}>
          <AppText role="titleSmall">{dashboard.organizerName}</AppText>
          <VerificationBadge status={dashboard.verificationStatus} />
          {dashboard.periodLabel ? (
            <AppText role="caption" color={theme.colors.textSecondary}>{dashboard.periodLabel}</AppText>
          ) : null}
        </View>
      </View>
      {primaryActionLabel || secondaryActionLabel ? (
        <Stack direction="horizontal" gap="sm" style={styles.headerActions}>
          {secondaryActionLabel ? (
            <SecondaryButton label={secondaryActionLabel} onPress={onSecondaryAction ?? (() => undefined)} />
          ) : null}
          {primaryActionLabel ? (
            <PrimaryButton label={primaryActionLabel} onPress={onPrimaryAction ?? (() => undefined)} />
          ) : null}
        </Stack>
      ) : null}
    </View>
  );
}

export interface OrganizerMetricCardProps {
  metric: OrganizerMetricViewModel;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 20/34 metric card — shared with admin metrics. */
export function OrganizerMetricCard({ metric, style, testID }: OrganizerMetricCardProps) {
  const { theme } = useTheme();

  if (metric.loading) {
    return (
      <CardFoundation padding="md" style={[styles.metricCard, style]} testID={testID}>
        <Skeleton width="40%" height={12} />
        <Skeleton width="60%" height={28} style={styles.metricSkeletonValue} />
        <Skeleton width="80%" height={10} />
      </CardFoundation>
    );
  }

  const changeColor =
    metric.changeDirection === 'up'
      ? theme.colors.success
      : metric.changeDirection === 'down'
        ? theme.colors.destructive
        : theme.colors.textSecondary;

  return (
    <View accessibilityLabel={metric.accessibilityLabel}>
      <CardFoundation padding="md" style={[styles.metricCard, style]} testID={testID}>
      <View style={styles.metricTop}>
        {metric.icon ? <AppIcon name={metric.icon} size="sm" color={theme.colors.accent} /> : null}
        <AppText role="caption" color={theme.colors.textSecondary} style={styles.metricLabel}>
          {metric.label}
        </AppText>
      </View>
      <AppText role="titleLarge">
        {metric.unavailable ? '—' : metric.valueLabel}
      </AppText>
      {metric.changeLabel ? (
        <AppText role="caption" color={changeColor}>{metric.changeLabel}</AppText>
      ) : null}
      </CardFoundation>
    </View>
  );
}

/** Alias for admin metric cards — same visual foundation. */
export const AdminMetricCard = OrganizerMetricCard;
export type AdminMetricCardProps = OrganizerMetricCardProps;

export interface OrganizerMetricGridProps {
  metrics: OrganizerMetricViewModel[];
  columns?: 2 | 3;
  style?: ViewStyle;
  testID?: string;
}

export function OrganizerMetricGrid({ metrics, columns = 2, style, testID }: OrganizerMetricGridProps) {
  return (
    <View style={[styles.metricGrid, style]} testID={testID}>
      {metrics.map((metric) => (
        <View key={metric.id} style={[styles.metricGridItem, { width: `${100 / columns}%` as `${number}%` }]}>
          <OrganizerMetricCard metric={metric} />
        </View>
      ))}
    </View>
  );
}

export interface OrganizerQuickActionProps {
  action: OrganizerQuickActionViewModel;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 20 quick access tiles. */
export function OrganizerQuickAction({ action, onPress, style, testID }: OrganizerQuickActionProps) {
  const { theme } = useTheme();

  return (
    <InteractiveCard onPress={onPress ?? (() => undefined)} accessibilityLabel={action.accessibilityLabel} style={style} testID={testID}>
      <CardFoundation padding="md" style={styles.quickAction}>
        <View style={[styles.quickActionIcon, { backgroundColor: theme.colors.accentMuted }]}>
          <AppIcon name={action.icon} color={theme.colors.accent} />
        </View>
        <AppText role="label">{action.title}</AppText>
        {action.description ? (
          <AppText role="caption" color={theme.colors.textSecondary} numberOfLines={2}>
            {action.description}
          </AppText>
        ) : null}
      </CardFoundation>
    </InteractiveCard>
  );
}

export interface OrganizerActivityItemProps {
  activity: OrganizerActivityViewModel;
  style?: ViewStyle;
  testID?: string;
}

export function OrganizerActivityItem({ activity, style, testID }: OrganizerActivityItemProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.activity, style]} testID={testID} accessibilityLabel={activity.accessibilityLabel}>
      <View style={[styles.activityIcon, { backgroundColor: theme.colors.surfaceSubtle }]}>
        <AppIcon name={activity.icon ?? 'pulse-outline'} size="sm" color={theme.colors.accent} />
      </View>
      <View style={styles.activityCopy}>
        <AppText role="bodyStrong">{activity.title}</AppText>
        {activity.subtitle ? (
          <AppText role="caption" color={theme.colors.textSecondary}>{activity.subtitle}</AppText>
        ) : null}
      </View>
      <AppText role="caption" color={theme.colors.textSecondary}>{activity.timestampLabel}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md },
  headerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  logo: {
    width: componentSize.organizerLogoSize,
    height: componentSize.organizerLogoSize,
    borderRadius: componentSize.organizerLogoSize / 2,
    borderWidth: borderWidth.strong,
  },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: spacing.xs },
  headerActions: { flexWrap: 'wrap' },
  metricCard: { gap: spacing.xs, flex: 1 },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metricLabel: { flex: 1 },
  metricSkeletonValue: { marginVertical: spacing.xs },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricGridItem: { minWidth: '45%' },
  quickAction: { gap: spacing.sm, alignItems: 'center', minHeight: 96 },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: componentSize.teamMemberRowMinHeight,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCopy: { flex: 1, gap: spacing.xs },
});
