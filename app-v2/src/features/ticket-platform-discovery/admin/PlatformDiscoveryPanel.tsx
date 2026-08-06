import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { getErrorMessage } from '@/core/errors/app-error';
import { platformDiscoveryService } from '@/data/repositories/registry';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import type {
  PlatformDiscoveryCandidate,
  PlatformDiscoveryReport,
  PlatformDiscoveryRun,
} from '@/features/ticket-platform-discovery/domain/types';
import { colorRoles } from '@/design/colors';
import { darkColors } from '@/design/theme/palettes/darkColors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

interface PlatformDiscoveryPanelProps {
  role: AdminRole | null;
}

export function PlatformDiscoveryPanel({ role }: PlatformDiscoveryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PlatformDiscoveryReport | null>(null);
  const [recentRuns, setRecentRuns] = useState<PlatformDiscoveryRun[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    try {
      const runs = await platformDiscoveryService.listRecentRuns(role);
      setRecentRuns(runs.slice(0, 5));
    } catch {
      // Non-blocking for panel mount.
    }
  }, [role]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadRecent();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadRecent]);

  const runDiscovery = async (platform: 'ticket_king' | 'ticket_io') => {
    setLoading(true);
    setError(null);
    try {
      const result =
        platform === 'ticket_king'
          ? await platformDiscoveryService.runTicketKingsDiscovery(role)
          : await platformDiscoveryService.runTicketIoDiscovery(role);
      setReport(result);
      await loadRecent();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const activate = async (candidateId: string) => {
    setActivatingId(candidateId);
    setError(null);
    try {
      const { candidate, source } = await platformDiscoveryService.activateCandidate(role, candidateId);
      setReport((current) =>
        current
          ? {
              ...current,
              candidates: current.candidates.map((entry) =>
                entry.id === candidate.id ? candidate : entry,
              ),
            }
          : current,
      );
      setError(null);
      void loadRecent();
      return source.id;
    } catch (cause) {
      setError(getErrorMessage(cause));
      return null;
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <View style={styles.card}>
      <AppText style={textRoles.sectionTitle}>Platform Discovery</AppText>
      <AppText style={styles.hint}>
        Discover ticket platform events beyond configured shops. Candidates require admin review before
        scheduler activation.
      </AppText>
      <View style={styles.actions}>
        <PrimaryButton
          label={loading ? 'Discovering…' : 'Discover Ticket Kings'}
          onPress={() => void runDiscovery('ticket_king')}
          disabled={loading}
        />
        <SecondaryButton
          label={loading ? 'Discovering…' : 'Discover Ticket.io Shops'}
          onPress={() => void runDiscovery('ticket_io')}
          disabled={loading}
        />
      </View>
      {loading ? <ActivityIndicator color={darkColors.accent} style={styles.spinner} /> : null}
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      {report ? <DiscoveryReportView report={report} activatingId={activatingId} onActivate={activate} /> : null}
      {recentRuns.length > 0 ? (
        <View style={styles.recent}>
          <AppText style={textRoles.label}>Recent runs</AppText>
          {recentRuns.map((run) => (
            <AppText key={run.id} style={styles.mono}>
              {run.platform} · {run.status} · accepted {run.summary.electronicEventsAccepted} /{' '}
              {run.summary.rawEventsDiscovered}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DiscoveryReportView({
  report,
  activatingId,
  onActivate,
}: {
  report: PlatformDiscoveryReport;
  activatingId: string | null;
  onActivate: (candidateId: string) => Promise<string | null>;
}) {
  const { run, candidates } = report;
  return (
    <View style={styles.report}>
      <AppText style={textRoles.label}>
        {run.platform} — {run.summary.electronicEventsAccepted} electronic /{' '}
        {run.summary.rawEventsDiscovered} raw
      </AppText>
      <AppText>
        New candidates: {run.summary.newShopCandidates} · Existing matches:{' '}
        {run.summary.existingSourceMatches}
      </AppText>
      {run.summary.limitations.map((limitation) => (
        <AppText key={limitation} style={styles.warning}>
          {limitation}
        </AppText>
      ))}
      {run.summary.rejectionReasons.length > 0 ? (
        <View>
          <AppText style={textRoles.label}>Rejection reasons</AppText>
          {run.summary.rejectionReasons.map((entry) => (
            <AppText key={entry.reason}>
              {entry.reason}: {entry.count}
            </AppText>
          ))}
        </View>
      ) : null}
      <View style={styles.candidateList}>
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            activating={activatingId === candidate.id}
            onActivate={onActivate}
          />
        ))}
      </View>
    </View>
  );
}

function CandidateRow({
  candidate,
  activating,
  onActivate,
}: {
  candidate: PlatformDiscoveryCandidate;
  activating: boolean;
  onActivate: (candidateId: string) => Promise<string | null>;
}) {
  const eventCount = candidate.discoveryStats?.eventCount ?? candidate.discoveryStats?.accepted ?? 0;
  const isActivated = candidate.status === 'activated';

  return (
    <View style={styles.candidate}>
      <AppText style={textRoles.label}>{candidate.displayName}</AppText>
      <AppText style={styles.mono}>
        {candidate.candidateType} · {candidate.status} · {eventCount} events
      </AppText>
      {candidate.duplicateSourceId ? (
        <AppText style={styles.warning}>Matches source: {candidate.duplicateSourceId}</AppText>
      ) : null}
      {isActivated ? (
        <AppText style={styles.success}>Activated</AppText>
      ) : (
        <PrimaryButton
          label={activating ? 'Activating…' : 'Activate source'}
          onPress={() => void onActivate(candidate.id)}
          disabled={activating}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colorRoles.cardBorder,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colorRoles.cardBackground,
  },
  hint: {
    color: colorRoles.emptyStateDescription,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  report: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  candidateList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  candidate: {
    borderTopWidth: 1,
    borderTopColor: colorRoles.cardBorder,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  recent: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
});
