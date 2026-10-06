import { StyleSheet, View, ViewStyle } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { Banner } from '@/components/feedback/Banner';
import { Badge } from '@/components/feedback/Badge';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import {
  resolveVerificationBadgeStatus,
  resolveVerificationStatusLabel,
} from './organizer-styles';
import type {
  OrganizerVerificationStatus,
  VerificationDocumentViewModel,
  VerificationRequirementViewModel,
} from './view-models';

export interface VerificationProgressProps {
  status: OrganizerVerificationStatus;
  completedSteps: number;
  totalSteps: number;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 50 verification progress. */
export function VerificationProgress({
  status,
  completedSteps,
  totalSteps,
  style,
  testID,
}: VerificationProgressProps) {
  const { theme } = useTheme();
  const ratio = totalSteps > 0 ? completedSteps / totalSteps : 0;

  return (
    <View style={[styles.progress, style]} testID={testID}>
      <View style={styles.progressHeader}>
        <Badge label={resolveVerificationStatusLabel(status)} status={resolveVerificationBadgeStatus(status)} />
        <AppText role="caption" color={theme.colors.textSecondary}>
          {completedSteps}/{totalSteps} Schritte
        </AppText>
      </View>
      <View style={[styles.progressBar, { backgroundColor: theme.colors.borderSubtle }]}>
        <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: theme.colors.accent }]} />
      </View>
    </View>
  );
}

export interface VerificationRequirementCardProps {
  requirement: VerificationRequirementViewModel;
  onActionPress?: () => void;
  actionLabel?: string;
  style?: ViewStyle;
  testID?: string;
}

export function VerificationRequirementCard({
  requirement,
  onActionPress,
  actionLabel = 'Bearbeiten',
  style,
  testID,
}: VerificationRequirementCardProps) {
  const { theme } = useTheme();
  const statusBadge =
    requirement.status === 'complete' ? 'success' : requirement.status === 'error' ? 'error' : 'warning';

  return (
    <View accessibilityLabel={requirement.accessibilityLabel}>
    <CardFoundation padding="md" style={[styles.requirement, style]} testID={testID}>
      <View style={styles.requirementHeader}>
        <AppIcon
          name={requirement.status === 'complete' ? 'checkmark-circle-outline' : 'ellipse-outline'}
          color={requirement.status === 'complete' ? theme.colors.success : theme.colors.textSecondary}
        />
        <View style={styles.requirementCopy}>
          <AppText role="bodyStrong">{requirement.title}</AppText>
          {requirement.description ? (
            <AppText role="caption" color={theme.colors.textSecondary}>{requirement.description}</AppText>
          ) : null}
        </View>
        <Badge
          label={requirement.status === 'complete' ? 'Erledigt' : requirement.status === 'error' ? 'Fehler' : 'Offen'}
          status={statusBadge}
        />
      </View>
      {onActionPress ? <GhostButton label={actionLabel} onPress={onActionPress} /> : null}
    </CardFoundation>
    </View>
  );
}

export interface VerificationDocumentRowProps {
  document: VerificationDocumentViewModel;
  onUploadPress?: () => void;
  onReplacePress?: () => void;
  onRemovePress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function VerificationDocumentRow({
  document,
  onUploadPress,
  onReplacePress,
  onRemovePress,
  style,
  testID,
}: VerificationDocumentRowProps) {
  const { theme } = useTheme();
  const statusLabel = {
    missing: 'Fehlt',
    uploaded: 'Hochgeladen',
    under_review: 'In Prüfung',
    approved: 'Genehmigt',
    rejected: 'Abgelehnt',
  }[document.status];

  return (
    <View style={[styles.documentRow, style]} testID={testID} accessibilityLabel={document.accessibilityLabel}>
      <AppIcon name="document-outline" color={theme.colors.textSecondary} />
      <View style={styles.documentCopy}>
        <AppText role="bodyStrong">{document.name}</AppText>
        <AppText role="caption" color={theme.colors.textSecondary}>{statusLabel}</AppText>
      </View>
      <Stack direction="horizontal" gap="xs">
        {document.status === 'missing' && onUploadPress ? (
          <GhostButton label="Hochladen" onPress={onUploadPress} />
        ) : null}
        {document.status !== 'missing' && onReplacePress ? (
          <GhostButton label="Ersetzen" onPress={onReplacePress} />
        ) : null}
        {onRemovePress ? <GhostButton label="Entfernen" onPress={onRemovePress} /> : null}
      </Stack>
    </View>
  );
}

export interface VerificationReviewStateProps {
  status: OrganizerVerificationStatus;
  title?: string;
  description?: string;
  onActionPress?: () => void;
  actionLabel?: string;
  style?: ViewStyle;
  testID?: string;
}

export function VerificationReviewState({
  status,
  title,
  description,
  onActionPress,
  actionLabel,
  style,
  testID,
}: VerificationReviewStateProps) {
  const resolvedTitle = title ?? resolveVerificationStatusLabel(status);
  const variant =
    status === 'approved' ? 'success' : status === 'rejected' ? 'error' : status === 'under_review' ? 'info' : 'warning';

  if (status === 'not_started') {
    return (
      <EmptyState
        title={resolvedTitle}
        description={description ?? 'Starte die Verifizierung, um als offizieller Veranstalter erkannt zu werden.'}
        icon="shield-checkmark-outline"
        primaryAction={onActionPress && actionLabel ? <PrimaryButton label={actionLabel} onPress={onActionPress} /> : undefined}
        style={style}
        testID={testID}
      />
    );
  }

  return (
    <Banner
      title={resolvedTitle}
      message={description}
      variant={variant}
      actionLabel={actionLabel}
      onAction={onActionPress}
      style={style}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  progress: { gap: spacing.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  requirement: { gap: spacing.sm },
  requirementHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  requirementCopy: { flex: 1, gap: spacing.xs },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  documentCopy: { flex: 1, gap: spacing.xs },
});
