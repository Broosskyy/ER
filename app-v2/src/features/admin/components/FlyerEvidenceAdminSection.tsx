import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { StoredFlyerLineupEvidence } from '@/features/import/services/flyer-evidence-metadata';

interface FlyerEvidenceAdminSectionProps {
  evidence?: StoredFlyerLineupEvidence;
}

export function FlyerEvidenceAdminSection({ evidence }: FlyerEvidenceAdminSectionProps) {
  if (!evidence) {
    return null;
  }

  return (
    <View style={styles.container}>
      <AppText style={styles.section}>Flyer Lineup Evidence</AppText>
      <AppText style={styles.meta}>Engine: {evidence.engine}</AppText>
      <AppText style={styles.meta}>Review: {evidence.reviewState}</AppText>
      <AppText style={styles.meta}>Confidence: {evidence.confidence.toFixed(2)}</AppText>
      <AppText style={styles.meta}>Hash: {evidence.contentHash}</AppText>
      {evidence.sourceConflict ? (
        <View style={styles.conflict}>
          <AppText style={styles.conflictTitle}>Source conflict</AppText>
          {evidence.sourceConflict.textualSpelling ? (
            <AppText style={styles.meta}>Textual: {evidence.sourceConflict.textualSpelling}</AppText>
          ) : null}
          {evidence.sourceConflict.flyerSpelling ? (
            <AppText style={styles.meta}>Flyer: {evidence.sourceConflict.flyerSpelling}</AppText>
          ) : null}
          {evidence.sourceConflict.reason ? (
            <AppText style={styles.meta}>Reason: {evidence.sourceConflict.reason}</AppText>
          ) : null}
        </View>
      ) : null}
      <AppText style={styles.rawLabel}>Extracted text</AppText>
      <AppText style={styles.rawText}>{evidence.rawText}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  section: {
    ...textRoles.sectionTitle,
  },
  meta: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  conflict: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  conflictTitle: {
    ...textRoles.cardTitle,
  },
  rawLabel: {
    ...textRoles.cardTitle,
    marginTop: spacing.sm,
  },
  rawText: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
    fontFamily: 'monospace',
  },
});
