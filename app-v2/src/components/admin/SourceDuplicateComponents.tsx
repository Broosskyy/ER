import { Image, StyleSheet, View, ViewStyle } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { Badge } from '@/components/feedback/Badge';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import {
  resolveDuplicateFieldBadgeStatus,
  resolveDuplicateFieldLabel,
  resolveSourceBadgeStatus,
  resolveSourceStatusLabel,
} from './admin-styles';
import type {
  CanonicalEventViewModel,
  DuplicateCandidateViewModel,
  DuplicateComparisonViewModel,
  EventSourceViewModel,
  SourceAttributionViewModel,
  SourceHealthViewModel,
  SourceStatus,
} from './view-models';

export interface SourceStatusBadgeProps {
  status: SourceStatus;
  style?: ViewStyle;
  testID?: string;
}

export function SourceStatusBadge({ status, style, testID }: SourceStatusBadgeProps) {
  return (
    <Badge
      label={resolveSourceStatusLabel(status)}
      status={resolveSourceBadgeStatus(status)}
      style={style}
      testID={testID}
    />
  );
}

export interface EventSourceCardProps {
  source: EventSourceViewModel;
  onSyncPress?: () => void;
  onConfigurePress?: () => void;
  onViewEventsPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 44 source manager card. */
export function EventSourceCard({ source, onSyncPress, onConfigurePress, onViewEventsPress, style, testID }: EventSourceCardProps) {
  const { theme } = useTheme();

  return (
    <View accessibilityLabel={source.accessibilityLabel}>
    <CardFoundation padding="md" style={[styles.sourceCard, style]} testID={testID}>
      <View style={styles.sourceHeader}>
        {source.logo ? (
          <Image source={source.logo} style={styles.sourceLogo} />
        ) : (
          <View style={[styles.sourceLogo, styles.sourceLogoFallback, { backgroundColor: theme.colors.surfaceSubtle }]}>
            <AppIcon name={source.icon ?? 'server-outline'} color={theme.colors.accent} />
          </View>
        )}
        <View style={styles.sourceCopy}>
          <AppText role="cardTitle">{source.name}</AppText>
          <AppText role="caption" color={theme.colors.accent}>{source.sourceTypeLabel}</AppText>
          {source.urlLabel ? <AppText role="caption" color={theme.colors.textSecondary}>{source.urlLabel}</AppText> : null}
          {source.lastImportLabel ? (
            <AppText role="caption" color={theme.colors.textSecondary}>Letzter Import: {source.lastImportLabel}</AppText>
          ) : null}
          {source.healthLabel ? (
            <AppText role="caption" color={theme.colors.textSecondary}>{source.healthLabel}</AppText>
          ) : null}
        </View>
        <SourceStatusBadge status={source.status} />
      </View>
      <View style={styles.sourceStats}>
        {source.eventCountLabel ? <AppText role="caption">Events: {source.eventCountLabel}</AppText> : null}
        {source.errorCountLabel ? (
          <AppText role="caption" color={theme.colors.destructive}>Fehler: {source.errorCountLabel}</AppText>
        ) : null}
      </View>
      <Stack direction="horizontal" gap="sm" style={styles.sourceActions}>
        {onViewEventsPress ? (
          <SecondaryButton label="Events anzeigen" onPress={onViewEventsPress} />
        ) : null}
        {onSyncPress ? <PrimaryButton label="Synchronisieren" onPress={onSyncPress} /> : null}
        {onConfigurePress ? <SecondaryButton label="Konfigurieren" onPress={onConfigurePress} /> : null}
      </Stack>
    </CardFoundation>
    </View>
  );
}

export interface SourceHealthRowProps {
  health: SourceHealthViewModel;
  style?: ViewStyle;
  testID?: string;
}

export function SourceHealthRow({ health, style, testID }: SourceHealthRowProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.healthRow, style]} testID={testID} accessibilityLabel={health.accessibilityLabel}>
      {health.successRateLabel ? <AppText role="caption">Erfolgsquote: {health.successRateLabel}</AppText> : null}
      {health.lastSuccessLabel ? (
        <AppText role="caption" color={theme.colors.textSecondary}>Letzter Erfolg: {health.lastSuccessLabel}</AppText>
      ) : null}
      {health.lastErrorLabel ? (
        <AppText role="caption" color={theme.colors.destructive}>{health.lastErrorLabel}</AppText>
      ) : null}
      {health.importCountLabel ? (
        <AppText role="caption" color={theme.colors.textSecondary}>Importe: {health.importCountLabel}</AppText>
      ) : null}
      {health.duplicateCountLabel ? (
        <AppText role="caption" color={theme.colors.warning}>Duplikate: {health.duplicateCountLabel}</AppText>
      ) : null}
    </View>
  );
}

export interface DuplicateCandidateCardProps {
  candidate: DuplicateCandidateViewModel;
  onComparePress?: () => void;
  onMergePress?: () => void;
  onNotDuplicatePress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function DuplicateCandidateCard({
  candidate,
  onComparePress,
  onMergePress,
  onNotDuplicatePress,
  style,
  testID,
}: DuplicateCandidateCardProps) {
  const { theme } = useTheme();

  return (
    <View accessibilityLabel={candidate.accessibilityLabel}>
    <CardFoundation padding="md" style={[styles.duplicateCard, style]} testID={testID}>
      <View style={styles.duplicateHeader}>
        <AppText role="sectionTitle">Mögliches Duplikat</AppText>
        <Badge label={candidate.similarityScoreLabel} status="warning" />
      </View>
      {candidate.events.map((event) => (
        <View key={event.id} style={styles.eventSummary}>
          <AppText role="bodyStrong">{event.title}</AppText>
          <AppText role="caption" color={theme.colors.textSecondary}>
            {event.dateLabel} · {event.venueLabel}
            {event.cityLabel ? ` · ${event.cityLabel}` : ''}
          </AppText>
          {event.sourceLabel ? <AppText role="caption" color={theme.colors.textSecondary}>Quelle: {event.sourceLabel}</AppText> : null}
          {event.organizerLabel ? <AppText role="caption" color={theme.colors.textSecondary}>Organizer: {event.organizerLabel}</AppText> : null}
        </View>
      ))}
      <Stack direction="horizontal" gap="sm" style={styles.duplicateActions}>
        {onComparePress ? <SecondaryButton label="Später entscheiden" onPress={onComparePress} /> : null}
        {onMergePress ? <PrimaryButton label="Gleiche Veranstaltung" onPress={onMergePress} /> : null}
        {onNotDuplicatePress ? <GhostButton label="Unterschiedliche Veranstaltung" onPress={onNotDuplicatePress} /> : null}
      </Stack>
    </CardFoundation>
    </View>
  );
}

export interface DuplicateComparisonRowProps {
  comparison: DuplicateComparisonViewModel;
  style?: ViewStyle;
  testID?: string;
}

export function DuplicateComparisonRow({ comparison, style, testID }: DuplicateComparisonRowProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.comparisonRow, style]} testID={testID}>
      <AppText role="bodyStrong" style={styles.comparisonLabel}>{comparison.fieldLabel}</AppText>
      <Badge label={resolveDuplicateFieldLabel(comparison.state)} status={resolveDuplicateFieldBadgeStatus(comparison.state)} />
      {comparison.leftValueLabel ? (
        <AppText role="caption" color={theme.colors.textSecondary}>A: {comparison.leftValueLabel}</AppText>
      ) : null}
      {comparison.rightValueLabel ? (
        <AppText role="caption" color={theme.colors.textSecondary}>B: {comparison.rightValueLabel}</AppText>
      ) : null}
    </View>
  );
}

export interface CanonicalEventSummaryProps {
  event: CanonicalEventViewModel;
  style?: ViewStyle;
  testID?: string;
}

export function CanonicalEventSummary({ event, style, testID }: CanonicalEventSummaryProps) {
  const { theme } = useTheme();

  return (
    <View accessibilityLabel={event.accessibilityLabel}>
    <CardFoundation padding="md" style={[styles.canonical, style]} testID={testID}>
      <AppText role="sectionTitle">Kanonische Vorschau</AppText>
      <AppText role="cardTitle">{event.title}</AppText>
      <AppText role="bodyMuted" color={theme.colors.textSecondary}>
        {event.dateLabel} · {event.venueLabel}
        {event.cityLabel ? ` · ${event.cityLabel}` : ''}
      </AppText>
      {event.sourceLabels?.length ? (
        <AppText role="caption" color={theme.colors.textSecondary}>
          Quellen: {event.sourceLabels.join(', ')}
        </AppText>
      ) : null}
    </CardFoundation>
    </View>
  );
}

export interface SourceAttributionRowProps {
  attribution: SourceAttributionViewModel;
  style?: ViewStyle;
  testID?: string;
}

export function SourceAttributionRow({ attribution, style, testID }: SourceAttributionRowProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.attributionRow, style]} testID={testID} accessibilityLabel={attribution.accessibilityLabel}>
      <AppText role="bodyStrong" style={styles.attributionSource}>{attribution.sourceLabel}</AppText>
      <AppText role="body">{attribution.valueLabel}</AppText>
      {attribution.freshnessLabel ? (
        <AppText role="caption" color={theme.colors.textSecondary}>{attribution.freshnessLabel}</AppText>
      ) : null}
      {attribution.priorityLabel ? (
        <AppText role="caption" color={theme.colors.accent}>Priorität: {attribution.priorityLabel}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sourceCard: { gap: spacing.md },
  sourceHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  sourceLogo: { width: 48, height: 48, borderRadius: 8 },
  sourceLogoFallback: { alignItems: 'center', justifyContent: 'center' },
  sourceCopy: { flex: 1, gap: spacing.xs },
  sourceStats: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  sourceActions: { flexWrap: 'wrap' },
  healthRow: { gap: spacing.xs },
  duplicateCard: { gap: spacing.md },
  duplicateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventSummary: { gap: spacing.xs, paddingVertical: spacing.xs },
  duplicateActions: { flexWrap: 'wrap' },
  comparisonRow: { gap: spacing.xs, paddingVertical: spacing.sm },
  comparisonLabel: { minWidth: 100 },
  canonical: { gap: spacing.sm },
  attributionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  attributionSource: { minWidth: 100 },
});
