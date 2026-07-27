import { StyleSheet, View, ViewStyle } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { IconButton } from '@/components/buttons/IconButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { InteractiveCard } from '@/components/cards/InteractiveCard';
import { Badge } from '@/components/feedback/Badge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { EventImage } from '@/components/discovery/EventImage';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { resolveSubmissionBadgeStatus, resolveSubmissionStatusLabel } from './organizer-styles';
import type { EventDraftViewModel } from './view-models';

export interface DraftProgressProps {
  currentStep: number;
  totalSteps: number;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 31 circular step progress — simplified as ring + label. */
export function DraftProgress({ currentStep, totalSteps, style, testID }: DraftProgressProps) {
  const { theme } = useTheme();
  const ratio = totalSteps > 0 ? currentStep / totalSteps : 0;
  const accessibilityLabel = `${currentStep} von ${totalSteps} Schritte abgeschlossen`;

  return (
    <View style={[styles.progress, style]} testID={testID} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.progressRing, { borderColor: theme.colors.borderSubtle }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.colors.accent,
              height: `${Math.round(ratio * 100)}%`,
            },
          ]}
        />
        <AppText role="caption" color={theme.colors.accent} style={styles.progressText}>
          {currentStep}/{totalSteps}
        </AppText>
      </View>
      <AppText role="caption" color={theme.colors.textSecondary}>Schritte</AppText>
    </View>
  );
}

export interface EventDraftCardProps {
  draft: EventDraftViewModel;
  onContinuePress?: () => void;
  onMorePress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 31 draft list card. */
export function EventDraftCard({ draft, onContinuePress, onMorePress, style, testID }: EventDraftCardProps) {
  const { theme } = useTheme();
  const moreAction = onMorePress ? (
    <IconButton icon="ellipsis-vertical" size="sm" accessibilityLabel="Weitere Aktionen" onPress={onMorePress} />
  ) : null;

  const content = (
    <CardFoundation padding="md" style={styles.draftCard}>
      <View style={styles.draftRow}>
        <EventImage source={draft.cover} variant="compact" style={styles.draftCover} />
        <View style={styles.draftCopy}>
          <View style={styles.draftTitleRow}>
            <AppText role="cardTitle" numberOfLines={1} style={styles.draftTitle}>{draft.title}</AppText>
            <Badge label={resolveSubmissionStatusLabel(draft.status)} status={resolveSubmissionBadgeStatus(draft.status)} />
          </View>
          {draft.genreLabels?.length ? (
            <Stack direction="horizontal" gap="xs" style={styles.wrap}>
              {draft.genreLabels.map((genre) => (
                <Badge key={genre} label={genre} status="info" />
              ))}
            </Stack>
          ) : null}
          {draft.dateLabel ? (
            <View style={styles.metaRow}>
              <AppIcon name="calendar-outline" size="sm" color={theme.colors.textSecondary} />
              <AppText role="caption" color={theme.colors.textSecondary}>{draft.dateLabel}</AppText>
            </View>
          ) : null}
          {draft.venueLabel ? (
            <View style={styles.metaRow}>
              <AppIcon name="location-outline" size="sm" color={theme.colors.textSecondary} />
              <AppText role="caption" color={theme.colors.textSecondary} numberOfLines={1}>{draft.venueLabel}</AppText>
            </View>
          ) : null}
          <AppText role="caption" color={theme.colors.textSecondary}>
            Zuletzt bearbeitet: {draft.lastEditedLabel}
          </AppText>
        </View>
        <DraftProgress currentStep={draft.currentStep} totalSteps={draft.totalSteps} />
      </View>
    </CardFoundation>
  );

  if (onContinuePress) {
    return (
      <InteractiveCard
        onPress={onContinuePress}
        accessibilityLabel={draft.accessibilityLabel}
        actions={moreAction}
        style={style}
        testID={testID}
      >
        {content}
      </InteractiveCard>
    );
  }

  return <View style={style} testID={testID} accessibilityLabel={draft.accessibilityLabel}>{content}</View>;
}

export interface DraftEmptyStateProps {
  onCreatePress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function DraftEmptyState({ onCreatePress, style, testID }: DraftEmptyStateProps) {
  return (
    <EmptyState
      title="Noch keine Entwürfe"
      description="Erstelle dein erstes Event und speichere es als Entwurf, um später weiterzuarbeiten."
      icon="document-text-outline"
      primaryAction={onCreatePress ? <PrimaryButton label="Neuen Entwurf erstellen" onPress={onCreatePress} /> : undefined}
      style={style}
      testID={testID}
    />
  );
}

export interface DraftMoreMenuProps {
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 31 more-menu actions as ghost buttons (no nested menu logic). */
export function DraftMoreMenu({ onRename, onDuplicate, onDelete, style, testID }: DraftMoreMenuProps) {
  return (
    <Stack direction="horizontal" gap="sm" style={style} testID={testID}>
      {onRename ? <GhostButton label="Umbenennen" onPress={onRename} /> : null}
      {onDuplicate ? <GhostButton label="Duplizieren" onPress={onDuplicate} /> : null}
      {onDelete ? <GhostButton label="Löschen" onPress={onDelete} /> : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  progress: { alignItems: 'center', gap: spacing.xs },
  progressRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.25,
  },
  progressText: { zIndex: 1 },
  draftCard: { gap: spacing.md },
  draftRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  draftCover: { width: 72, height: 72 },
  draftCopy: { flex: 1, gap: spacing.xs },
  draftTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  draftTitle: { flex: 1 },
  wrap: { flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
