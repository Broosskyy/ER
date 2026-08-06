import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { getErrorMessage } from '@/core/errors/app-error';
import { sourceOnboardingService } from '@/data/repositories/registry';
import type { SourceOnboardingJob } from '@/features/source-onboarding/domain/types';
import { colorRoles } from '@/design/colors';
import { darkColors } from '@/design/theme/palettes/darkColors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { AdminRole } from '@/features/import/admin/admin-roles';

interface SourceOnboardingWizardProps {
  role: AdminRole | null;
}

export function SourceOnboardingWizard({ role }: SourceOnboardingWizardProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<SourceOnboardingJob | null>(null);

  const discover = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await sourceOnboardingService.discoverFromUrl(role, { url });
      setJob(response.job);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <AppText style={textRoles.sectionTitle}>Source Discovery</AppText>
      <AppText style={styles.hint}>
        Enter a URL to analyze platform, event structure, and generate a declarative source configuration.
      </AppText>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://example.com/events"
        placeholderTextColor={colorRoles.searchPlaceholder}
        autoCapitalize="none"
        style={styles.input}
      />
      <PrimaryButton label={loading ? 'Analyzing…' : 'Discover Source'} onPress={() => void discover()} disabled={loading || !url.trim()} />
      {loading ? <ActivityIndicator color={darkColors.accent} style={styles.spinner} /> : null}
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      {job ? <OnboardingJobSummary job={job} /> : null}
    </View>
  );
}

function OnboardingJobSummary({ job }: { job: SourceOnboardingJob }) {
  return (
    <View style={styles.summary}>
      <AppText style={textRoles.label}>Status: {job.status}</AppText>
      {job.detectedPlatform ? <AppText>Platform: {job.detectedPlatform}</AppText> : null}
      {job.detectedFramework ? <AppText>Framework: {job.detectedFramework}</AppText> : null}
      {job.detectedSourceType ? <AppText>Source type: {job.detectedSourceType}</AppText> : null}
      <AppText>Confidence: {(job.confidence * 100).toFixed(0)}%</AppText>
      {job.duplicateSourceId ? (
        <AppText style={styles.warning}>Duplicate source: {job.duplicateSourceId}</AppText>
      ) : null}
      {job.discoveryResult?.warnings.map((warning) => (
        <AppText key={warning} style={styles.warning}>
          {warning}
        </AppText>
      ))}
      {job.generatedConfig ? (
        <AppText style={styles.mono}>
          Strategy: {job.generatedConfig.acquisition.strategy} · {job.generatedConfig.acquisition.listUrl}
        </AppText>
      ) : null}
      {job.dryRunReport ? (
        <View style={styles.dryRun}>
          <AppText style={textRoles.label}>Dry run</AppText>
          <AppText>Parsed: {job.dryRunReport.parsedEvents}</AppText>
          <AppText>Electronic: {job.dryRunReport.electronicEvents}</AppText>
          <AppText>Rejected: {job.dryRunReport.rejectedEvents}</AppText>
          <AppText>New candidates: {job.dryRunReport.newCandidates}</AppText>
          {job.dryRunReport.risks.map((risk) => (
            <AppText key={risk} style={styles.warning}>
              {risk}
            </AppText>
          ))}
        </View>
      ) : null}
      {job.status === 'review_required' ? (
        <AppText style={styles.warning}>Manual review required before activation.</AppText>
      ) : null}
      {job.status === 'ready' ? (
        <AppText style={styles.success}>Configuration ready — create source manually from generated config.</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colorRoles.cardBorder,
    backgroundColor: colorRoles.cardBackground,
  },
  hint: {
    color: colorRoles.emptyStateDescription,
  },
  input: {
    borderWidth: 1,
    borderColor: colorRoles.cardBorder,
    borderRadius: 8,
    padding: spacing.sm,
    color: colorRoles.searchText,
    backgroundColor: colorRoles.appBackground,
  },
  spinner: {
    marginTop: spacing.xs,
  },
  error: {
    color: darkColors.destructive,
  },
  warning: {
    color: darkColors.warning,
  },
  success: {
    color: darkColors.success,
  },
  summary: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colorRoles.cardBorder,
  },
  dryRun: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
