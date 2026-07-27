import { Image, StyleSheet, View, ViewStyle } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { IconButton } from '@/components/buttons/IconButton';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { Badge } from '@/components/feedback/Badge';
import { MultilineInput } from '@/components/inputs/MultilineInput';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { resolveReviewBadgeStatus, resolveReviewStatusLabel } from './admin-styles';
import type { AdminReviewViewModel, ReviewTimelineViewModel } from './view-models';

export interface ReviewStatusBadgeProps {
  status: AdminReviewViewModel['status'];
  style?: ViewStyle;
  testID?: string;
}

export function ReviewStatusBadge({ status, style, testID }: ReviewStatusBadgeProps) {
  return (
    <Badge
      label={resolveReviewStatusLabel(status)}
      status={resolveReviewBadgeStatus(status)}
      style={style}
      testID={testID}
    />
  );
}

export interface AdminReviewCardProps {
  review: AdminReviewViewModel;
  onPreviewPress?: () => void;
  onApprovePress?: () => void;
  onRequestChangesPress?: () => void;
  onRejectPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 42/43 review card. */
export function AdminReviewCard({
  review,
  onPreviewPress,
  onApprovePress,
  onRequestChangesPress,
  onRejectPress,
  style,
  testID,
}: AdminReviewCardProps) {
  const { theme } = useTheme();

  const content = (
    <CardFoundation padding="md" style={styles.reviewCard}>
      <View style={styles.reviewRow}>
        {review.thumbnail ? <Image source={review.thumbnail} style={styles.thumbnail} /> : null}
        <View style={styles.reviewCopy}>
          <View style={styles.reviewTitleRow}>
            <AppText role="cardTitle" numberOfLines={1} style={styles.reviewTitle}>{review.title}</AppText>
            {review.isNew ? <Badge label="NEW" status="info" /> : null}
            <ReviewStatusBadge status={review.status} />
            {onPreviewPress ? (
              <IconButton icon="eye-outline" size="sm" accessibilityLabel="Vorschau" onPress={onPreviewPress} />
            ) : null}
          </View>
          {review.locationLabel ? (
            <View style={styles.metaRow}>
              <AppIcon name="location-outline" size="sm" color={theme.colors.textSecondary} />
              <AppText role="caption" color={theme.colors.textSecondary}>{review.locationLabel}</AppText>
            </View>
          ) : null}
          {review.dateLabel ? (
            <View style={styles.metaRow}>
              <AppIcon name="calendar-outline" size="sm" color={theme.colors.textSecondary} />
              <AppText role="caption" color={theme.colors.textSecondary}>{review.dateLabel}</AppText>
            </View>
          ) : null}
          {review.submittedByLabel ? (
            <AppText role="caption" color={theme.colors.textSecondary}>{review.submittedByLabel}</AppText>
          ) : null}
          {review.hintLabel ? (
            <AppText role="caption" color={theme.colors.warning}>{review.hintLabel}</AppText>
          ) : null}
          <AppText role="caption" color={theme.colors.textSecondary}>{review.timestampLabel}</AppText>
        </View>
      </View>
      <AdminDecisionBar
        onApprovePress={onApprovePress}
        onRequestChangesPress={onRequestChangesPress}
        onRejectPress={onRejectPress}
      />
    </CardFoundation>
  );

  return (
    <View style={style} testID={testID} accessibilityLabel={review.accessibilityLabel}>
      {content}
    </View>
  );
}

export interface AdminDecisionBarProps {
  onApprovePress?: () => void;
  onRequestChangesPress?: () => void;
  onRejectPress?: () => void;
  onEscalatePress?: () => void;
  approveLabel?: string;
  requestChangesLabel?: string;
  rejectLabel?: string;
  escalateLabel?: string;
  style?: ViewStyle;
  testID?: string;
}

export function AdminDecisionBar({
  onApprovePress,
  onRequestChangesPress,
  onRejectPress,
  onEscalatePress,
  approveLabel = 'Genehmigen',
  requestChangesLabel = 'Änderungen anfordern',
  rejectLabel = 'Ablehnen',
  escalateLabel = 'Eskalieren',
  style,
  testID,
}: AdminDecisionBarProps) {
  return (
    <Stack direction="horizontal" gap="sm" style={[styles.decisionBar, style]} testID={testID}>
      {onApprovePress ? <PrimaryButton label={approveLabel} onPress={onApprovePress} /> : null}
      {onRequestChangesPress ? <SecondaryButton label={requestChangesLabel} onPress={onRequestChangesPress} /> : null}
      {onRejectPress ? <GhostButton label={rejectLabel} onPress={onRejectPress} /> : null}
      {onEscalatePress ? <GhostButton label={escalateLabel} onPress={onEscalatePress} /> : null}
    </Stack>
  );
}

export interface ReviewReasonFieldProps {
  label: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  style?: ViewStyle;
  testID?: string;
}

export function ReviewReasonField({
  label,
  placeholder = 'Grund eingeben…',
  value,
  onChangeText,
  style,
  testID,
}: ReviewReasonFieldProps) {
  return (
    <View style={[styles.reasonField, style]} testID={testID}>
      <AppText role="label">{label}</AppText>
      <MultilineInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={label}
      />
    </View>
  );
}

export interface ReviewTimelineProps {
  timeline: ReviewTimelineViewModel;
  style?: ViewStyle;
  testID?: string;
}

export function ReviewTimeline({ timeline, style, testID }: ReviewTimelineProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.timeline, style]} testID={testID} accessibilityLabel={timeline.accessibilityLabel}>
      {timeline.entries.map((entry, index) => {
        const isLast = index === timeline.entries.length - 1;
        const dotColor =
          entry.status === 'completed'
            ? theme.colors.success
            : entry.status === 'active'
              ? theme.colors.accent
              : theme.colors.borderSubtle;

        return (
          <View key={entry.id} style={styles.timelineEntry}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
              {!isLast ? <View style={[styles.timelineLine, { backgroundColor: theme.colors.borderSubtle }]} /> : null}
            </View>
            <View style={styles.timelineCopy}>
              <AppText role="bodyStrong">{entry.label}</AppText>
              {entry.actorLabel ? (
                <AppText role="caption" color={theme.colors.textSecondary}>{entry.actorLabel}</AppText>
              ) : null}
              <AppText role="caption" color={theme.colors.textSecondary}>{entry.timestampLabel}</AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  reviewCard: { gap: spacing.md },
  reviewRow: { flexDirection: 'row', gap: spacing.md },
  thumbnail: { width: 64, height: 64, borderRadius: 8 },
  reviewCopy: { flex: 1, gap: spacing.xs },
  reviewTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  reviewTitle: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  decisionBar: { flexWrap: 'wrap' },
  reasonField: { gap: spacing.sm },
  timeline: { gap: spacing.sm },
  timelineEntry: { flexDirection: 'row', gap: spacing.md },
  timelineRail: { alignItems: 'center', width: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { flex: 1, width: 2, minHeight: 24 },
  timelineCopy: { flex: 1, gap: spacing.xs, paddingBottom: spacing.md },
});
