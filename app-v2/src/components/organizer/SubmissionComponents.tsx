import type { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { Banner } from '@/components/feedback/Banner';
import { Badge } from '@/components/feedback/Badge';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import {
  resolveSubmissionBadgeStatus,
  resolveSubmissionBannerVariant,
  resolveSubmissionStatusLabel,
} from './organizer-styles';
import type {
  SubmissionFieldSummaryViewModel,
  SubmissionReviewViewModel,
  SubmissionStatus,
  SubmissionStepViewModel,
} from './view-models';

export interface SubmissionProgressProps {
  steps: SubmissionStepViewModel[];
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 21 numbered stepper. */
export function SubmissionProgress({ steps, style, testID }: SubmissionProgressProps) {
  const { theme } = useTheme();
  const activeStep = steps.find((step) => step.state === 'active');
  const accessibilityLabel = activeStep
    ? `Schritt ${activeStep.index} von ${steps.length}: ${activeStep.label}`
    : `Submission Fortschritt, ${steps.length} Schritte`;

  return (
    <View style={[styles.progress, style]} testID={testID} accessibilityLabel={accessibilityLabel}>
      <View style={styles.progressRow} accessibilityRole="progressbar">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const active = step.state === 'active';
          const completed = step.state === 'completed';
          const error = step.state === 'error';
          const circleColor = error
            ? theme.colors.destructive
            : active || completed
              ? theme.colors.accent
              : theme.colors.borderSubtle;
          const textColor = active ? theme.colors.accent : theme.colors.textSecondary;

          return (
            <View key={step.id} style={styles.progressStep}>
              <View style={styles.progressNodeRow}>
                <View style={[styles.progressCircle, { backgroundColor: circleColor, borderColor: circleColor }]}>
                  <AppText role="caption" color={active || completed || error ? theme.colors.textOnAccent : theme.colors.textSecondary}>
                    {step.index}
                  </AppText>
                </View>
                {!isLast ? (
                  <View style={[styles.progressLine, { backgroundColor: completed ? theme.colors.accent : theme.colors.borderSubtle }]} />
                ) : null}
              </View>
              <AppText role="caption" color={textColor} numberOfLines={1} style={styles.progressLabel}>
                {step.label}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export interface SubmissionStepHeaderProps {
  stepIndex: number;
  totalSteps: number;
  title: string;
  description?: string;
  statusLabel?: string;
  helpLabel?: string;
  onHelpPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function SubmissionStepHeader({
  stepIndex,
  totalSteps,
  title,
  description,
  statusLabel,
  helpLabel,
  onHelpPress,
  style,
  testID,
}: SubmissionStepHeaderProps) {
  const { theme } = useTheme();

  return (
    <CardFoundation padding="md" style={[styles.stepHeader, style]} testID={testID}>
      <View style={styles.stepHeaderRow}>
        <View style={[styles.stepBadge, { backgroundColor: theme.colors.accentMuted }]}>
          <AppText role="label" color={theme.colors.accent}>{stepIndex}</AppText>
        </View>
        <View style={styles.stepHeaderCopy}>
          <AppText role="caption" color={theme.colors.accent}>
            Schritt {stepIndex} von {totalSteps}
          </AppText>
          <AppText role="sectionTitle">{title}</AppText>
          {description ? <AppText role="bodyMuted" color={theme.colors.textSecondary}>{description}</AppText> : null}
          {statusLabel ? <Badge label={statusLabel} status="info" /> : null}
        </View>
        {helpLabel ? (
          <IconButton icon="help-circle-outline" size="sm" accessibilityLabel={helpLabel} onPress={onHelpPress} />
        ) : null}
      </View>
    </CardFoundation>
  );
}

export interface SubmissionSectionProps {
  title: string;
  description?: string;
  required?: boolean;
  errorLabel?: string;
  children?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function SubmissionSection({
  title,
  description,
  required,
  errorLabel,
  children,
  style,
  testID,
}: SubmissionSectionProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.section, style]} testID={testID}>
      <View style={styles.sectionHeader}>
        <AppText role="sectionTitle">{title}</AppText>
        {required ? <AppText role="caption" color={theme.colors.accent}>*</AppText> : null}
      </View>
      {description ? <AppText role="bodyMuted" color={theme.colors.textSecondary}>{description}</AppText> : null}
      {errorLabel ? <AppText role="caption" color={theme.colors.destructive}>{errorLabel}</AppText> : null}
      {children}
    </View>
  );
}

export interface SubmissionFieldSummaryProps {
  fields: SubmissionFieldSummaryViewModel[];
  style?: ViewStyle;
  testID?: string;
}

export function SubmissionFieldSummary({ fields, style, testID }: SubmissionFieldSummaryProps) {
  const { theme } = useTheme();

  return (
    <CardFoundation padding="md" style={[styles.summary, style]} testID={testID}>
      {fields.map((field) => (
        <View key={field.id} style={styles.summaryRow} accessibilityLabel={field.label}>
          {field.icon ? <AppIcon name={field.icon} size="sm" color={theme.colors.textSecondary} /> : null}
          <View style={styles.summaryCopy}>
            <AppText role="caption" color={theme.colors.textSecondary}>{field.label}</AppText>
            <AppText role="bodyStrong" color={field.missing ? theme.colors.destructive : undefined}>
              {field.valueLabel}
            </AppText>
          </View>
        </View>
      ))}
    </CardFoundation>
  );
}

export interface SubmissionReviewCardProps {
  review: SubmissionReviewViewModel;
  onEditPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

export function SubmissionReviewCard({ review, onEditPress, style, testID }: SubmissionReviewCardProps) {
  const { theme } = useTheme();

  return (
    <View accessibilityLabel={review.accessibilityLabel}>
    <CardFoundation padding="md" style={[styles.reviewCard, style]} testID={testID}>
      <View style={styles.reviewHeader}>
        <AppText role="cardTitle">{review.title}</AppText>
        <Badge label={resolveSubmissionStatusLabel(review.status)} status={resolveSubmissionBadgeStatus(review.status)} />
      </View>
      {review.completenessLabel ? (
        <AppText role="bodyMuted" color={theme.colors.textSecondary}>{review.completenessLabel}</AppText>
      ) : null}
      {review.warningLabel ? (
        <AppText role="caption" color={theme.colors.warning}>{review.warningLabel}</AppText>
      ) : null}
      {review.errorLabel ? (
        <AppText role="caption" color={theme.colors.destructive}>{review.errorLabel}</AppText>
      ) : null}
      {onEditPress ? (
        <GhostButton label="Bearbeiten" onPress={onEditPress} />
      ) : null}
    </CardFoundation>
    </View>
  );
}

export interface SubmissionFooterActionsProps {
  onBack?: () => void;
  onNext?: () => void;
  onSaveDraft?: () => void;
  onPreview?: () => void;
  onSubmit?: () => void;
  backLabel?: string;
  nextLabel?: string;
  saveDraftLabel?: string;
  previewLabel?: string;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function SubmissionFooterActions({
  onBack,
  onNext,
  onSaveDraft,
  onPreview,
  onSubmit,
  backLabel = 'Zurück',
  nextLabel = 'Weiter',
  saveDraftLabel = 'Als Entwurf speichern',
  previewLabel = 'Vorschau',
  submitLabel = 'Zur Prüfung einreichen',
  loading,
  disabled,
  style,
  testID,
}: SubmissionFooterActionsProps) {
  return (
    <Stack gap="sm" style={style} testID={testID}>
      <Stack direction="horizontal" gap="sm" style={styles.footerRow}>
        {onBack ? <SecondaryButton label={backLabel} onPress={onBack} disabled={disabled} /> : null}
        {onNext ? <PrimaryButton label={nextLabel} onPress={onNext} loading={loading} disabled={disabled} /> : null}
        {onSubmit ? <PrimaryButton label={submitLabel} onPress={onSubmit} loading={loading} disabled={disabled} /> : null}
      </Stack>
      <Stack direction="horizontal" gap="sm" style={styles.footerRow}>
        {onSaveDraft ? <GhostButton label={saveDraftLabel} onPress={onSaveDraft} disabled={disabled} /> : null}
        {onPreview ? <GhostButton label={previewLabel} onPress={onPreview} disabled={disabled} /> : null}
      </Stack>
    </Stack>
  );
}

export interface SubmissionStatusBannerProps {
  status: SubmissionStatus;
  title?: string;
  message?: string;
  style?: ViewStyle;
  testID?: string;
}

export function SubmissionStatusBanner({ status, title, message, style, testID }: SubmissionStatusBannerProps) {
  const resolvedTitle = title ?? resolveSubmissionStatusLabel(status);

  return (
    <Banner
      title={resolvedTitle}
      message={message}
      variant={resolveSubmissionBannerVariant(status)}
      style={style}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  progress: { gap: spacing.sm },
  progressRow: { flexDirection: 'row' },
  progressStep: { flex: 1, alignItems: 'center', gap: spacing.xs },
  progressNodeRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  progressCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  progressLine: { flex: 1, height: 2, marginHorizontal: spacing.xs },
  progressLabel: { textAlign: 'center' },
  stepHeader: { gap: spacing.sm },
  stepHeaderRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeaderCopy: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summary: { gap: spacing.md },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  summaryCopy: { flex: 1, gap: spacing.xs },
  reviewCard: { gap: spacing.sm },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  footerRow: { flexWrap: 'wrap' },
});
