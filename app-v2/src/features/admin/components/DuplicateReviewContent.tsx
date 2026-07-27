import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  DuplicateCandidateCard,
  DuplicateComparisonRow,
} from '@/components/admin/SourceDuplicateComponents';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { getErrorMessage } from '@/core/errors/app-error';
import {
  adminEventModerationService,
  adminMultiSourceService,
} from '@/data/repositories/registry';
import type { AdminEventRecord } from '@/data/types/records';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import type { DuplicateReviewContext } from '@/features/admin/services/admin-multi-source-service';
import {
  buildDuplicateCandidate,
  buildDuplicateComparisons,
} from '@/features/admin/utils/admin-review-mapper';

export function DuplicateReviewContent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAdminAuth();
  const [submission, setSubmission] = useState<AdminEventRecord | null>(null);
  const [candidates, setCandidates] = useState<AdminEventRecord[]>([]);
  const [context, setContext] = useState<DuplicateReviewContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [event, matches, reviewContext] = await Promise.all([
        adminEventModerationService.getReviewEvent(session, id),
        adminEventModerationService.findPreparedDuplicateCandidates(session, id),
        adminMultiSourceService.loadDuplicateReviewContext(id),
      ]);

      setSubmission(event);
      setCandidates(matches);
      setContext(reviewContext);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const saveDecision = async (
    candidateId: string,
    decision: 'merged' | 'kept_separate' | 'deferred',
  ) => {
    if (!session || !submission) {
      return;
    }

    try {
      await adminMultiSourceService.decideDuplicate({
        actorId: session.user.id,
        candidateIds: [submission.id, candidateId],
        sourceIds: [submission.sourceId ?? 'submission', candidateId],
        canonicalEventId: submission.id,
        decision,
        reason: `Admin duplicate review: ${decision}`,
        contributions: decision === 'merged'
          ? [{
              sourceId: candidateId,
              sourceName: candidateId,
              externalEventId: candidateId,
              sourcePriority: 50,
              sourceTrustScore: 50,
              retrievedAt: new Date().toISOString(),
              event: {
                externalId: candidateId,
                sourceId: candidateId,
                sourceName: candidateId,
                title: submission.title,
                description: submission.description,
                startDate: submission.startDate,
                venueName: submission.venueName,
                rawSourceType: 'unknown',
              },
            }]
          : undefined,
      });
      await load();
      setSuccess(
        decision === 'merged'
          ? 'Quellen zusammengeführt.'
          : decision === 'kept_separate'
            ? 'Als getrennte Veranstaltungen markiert.'
            : 'Entscheidung zurückgestellt.',
      );
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  };

  if (loading || !submission) {
    if (error) {
      return <AdminErrorState message={error} onRetry={load} />;
    }
    return <AdminLoadingState label="Dublettenprüfung wird geladen…" />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Zurück" onPress={() => router.back()} />
            <AppText role="sectionTitle" style={styles.title}>Dublettenprüfung</AppText>
          </View>

          <AppText style={styles.description}>
            Vergleiche Kandidaten mit persistierten Quellen, Provenance und Konflikten.
          </AppText>

          {context ? (
            <View style={styles.summaryCard}>
              <AppText style={styles.meta}>
                Quellen: {context.sourceReferences.length} · Provenance: {context.fieldProvenance.length} ·
                Konflikte: {context.conflicts.filter((entry) => !entry.resolved).length}
              </AppText>
            </View>
          ) : null}

          {success ? <AppText style={styles.success}>{success}</AppText> : null}
          {error ? <AppText style={styles.error}>{error}</AppText> : null}

          {candidates.length === 0 ? (
            <AdminEmptyState
              title="Keine Kandidaten gefunden"
              description="Für diese Einreichung wurden keine vorbereiteten Dubletten gefunden."
            />
          ) : (
            candidates.map((candidate) => {
              const card = buildDuplicateCandidate(submission, candidate);
              const comparisons = buildDuplicateComparisons(submission, candidate);

              return (
                <View key={candidate.id} style={styles.candidateBlock}>
                  <DuplicateCandidateCard
                    candidate={card}
                    onMergePress={() => void saveDecision(candidate.id, 'merged')}
                    onNotDuplicatePress={() => void saveDecision(candidate.id, 'kept_separate')}
                    onComparePress={() => void saveDecision(candidate.id, 'deferred')}
                  />
                  {comparisons.map((comparison) => (
                    <DuplicateComparisonRow key={`${candidate.id}-${comparison.fieldLabel}`} comparison={comparison} />
                  ))}
                </View>
              );
            })
          )}

          <PrimaryButton
            label="Zurück zum Review"
            onPress={() => router.push(`/admin/events/review/${submission.id}`)}
          />
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacingRoles.screenHorizontal,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { flex: 1 },
  description: { ...textRoles.metadata },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: spacing.md,
  },
  meta: { ...textRoles.metadata },
  candidateBlock: { gap: spacing.md },
  success: { ...textRoles.metadata, color: '#7dd3a8' },
  error: { ...textRoles.metadata, color: '#ff6b6b' },
});
