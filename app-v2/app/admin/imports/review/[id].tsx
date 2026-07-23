import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { ImportRecord } from '@/features/import/models/types';
import { importReviewService, sourceRepository, venueRepository, organizerRepository } from '@/data/repositories/registry';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { REJECT_REASON_LABELS } from '@/features/import/admin/reject-reasons';
import { useAdminRole } from '@/features/import/admin/use-admin-role';
import type { RejectReason } from '@/features/import/models/statuses';
import type { SourceRecord } from '@/data/types/records';
import { formatSourceStatus, formatSourceTypeLabel } from '@/features/sources/admin/source-labels';

export default function ReviewDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, can } = useAdminRole();
  const [record, setRecord] = useState<ImportRecord | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [matchedVenueName, setMatchedVenueName] = useState<string | null>(null);
  const [matchedOrganizerName, setMatchedOrganizerName] = useState<string | null>(null);
  const [source, setSource] = useState<SourceRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await importReviewService.getRecord(session, id);
      if (loaded) {
        setRecord(loaded);
        setTitle(getEffectiveCandidate(loaded).title);
        const matchedVenueId =
          loaded.reviewerEdits?.matchedVenueId ?? loaded.matchedVenueId ?? undefined;
        if (matchedVenueId) {
          const venue = await venueRepository.getById(matchedVenueId);
          setMatchedVenueName(venue ? `${venue.name} (${venue.city}, ${venue.country})` : null);
        } else {
          setMatchedVenueName(null);
        }
        const matchedOrganizerId =
          loaded.reviewerEdits?.matchedOrganizerId ?? loaded.matchedOrganizerId ?? undefined;
        if (matchedOrganizerId) {
          const organizer = await organizerRepository.getById(matchedOrganizerId);
          setMatchedOrganizerName(
            organizer
              ? `${organizer.name}${organizer.city ? ` (${organizer.city}${organizer.country ? `, ${organizer.country}` : ''})` : ''}`
              : null,
          );
        } else {
          setMatchedOrganizerName(null);
        }

        const linkedSource = await sourceRepository.getById(loaded.sourceId);
        setSource(linkedSource);
      }
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

  const handleSaveEdits = async () => {
    if (!session || !record || !can('records:edit')) return;
    setActing(true);
    setError(null);
    try {
      const updated = await importReviewService.editRecord(
        session,
        record.id,
        { title },
        record.updatedAt,
      );
      setRecord(updated);
      setSuccess('Changes saved.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  const handleApprove = async () => {
    if (!session || !record || !can('records:approve')) return;
    setActing(true);
    setError(null);
    try {
      const { record: updated, event } = await importReviewService.approveRecord(
        session,
        record.id,
        record.updatedAt,
      );
      setRecord(updated);
      setSuccess(`Approved. Draft event ${event.id} created.`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!session || !record || !can('records:reject')) return;
    setActing(true);
    setError(null);
    try {
      const updated = await importReviewService.rejectRecord(
        session,
        record.id,
        'not_relevant' as RejectReason,
        undefined,
        record.updatedAt,
      );
      setRecord(updated);
      setSuccess('Record rejected.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  const handleConfirmDuplicate = async () => {
    if (!session || !record || !record.duplicateEventId || !can('records:duplicate')) return;
    setActing(true);
    setError(null);
    try {
      const updated = await importReviewService.confirmDuplicate(
        session,
        record.id,
        record.duplicateEventId,
        record.updatedAt,
      );
      setRecord(updated);
      setSuccess('Marked as duplicate.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  const handleDismissDuplicate = async () => {
    if (!session || !record || !can('records:duplicate')) return;
    setActing(true);
    setError(null);
    try {
      const updated = await importReviewService.dismissDuplicate(
        session,
        record.id,
        record.updatedAt,
      );
      setRecord(updated);
      setSuccess('Duplicate suggestion dismissed.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading record…" />;
  if (error && !record) {
    return <AdminErrorState message={error} onRetry={load} />;
  }
  if (!record) {
    return <AdminErrorState message="Record not found." onRetry={load} />;
  }

  const candidate = getEffectiveCandidate(record);
  const rawArtistNames = candidate.artistNames ?? [];
  const matchedArtistIds = [
    ...new Set(
      (record.reviewerEdits?.matchedArtistIds ?? record.matchedArtistIds ?? []).filter(Boolean),
    ),
  ];
  const duplicateMatchedArtistIds = matchedArtistIds.filter(
    (artistId, index) => matchedArtistIds.indexOf(artistId) !== index,
  );
  const unmatchedArtistNames =
    rawArtistNames.length > matchedArtistIds.length
      ? rawArtistNames.slice(matchedArtistIds.length)
      : [];

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>Review</AppText>
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Source Provenance</AppText>
            <AppText style={styles.meta}>
              Source: {record.sourceName ?? source?.displayName ?? record.sourceId}
            </AppText>
            <AppText style={styles.meta}>
              Type: {formatSourceTypeLabel(record.sourceType ?? source?.sourceType ?? 'unknown')}
            </AppText>
            <AppText style={styles.meta}>
              Original URL: {record.originalUrl ?? record.sourceUrl ?? '—'}
            </AppText>
            <AppText style={styles.meta}>
              Retrieved:{' '}
              {record.retrievedAt ? new Date(record.retrievedAt).toLocaleString() : '—'}
            </AppText>
            <AppText style={styles.meta}>
              Current source status:{' '}
              {source
                ? formatSourceStatus(source.enabled, source.archived)
                : 'Unknown'}
            </AppText>
          </View>

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Status: {record.status}</AppText>
            <AppText style={styles.meta}>External ID: {record.externalId}</AppText>
            {record.sourceUrl ? (
              <AppText style={styles.meta}>Source URL: {record.sourceUrl}</AppText>
            ) : null}
          </View>

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Normalized Data</AppText>
            {can('records:edit') ? (
              <>
                <AppText style={styles.label}>Title</AppText>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} />
                <SecondaryButton label="Save edits" onPress={handleSaveEdits} disabled={acting} />
              </>
            ) : (
              <AppText style={styles.value}>{candidate.title}</AppText>
            )}
            <AppText style={styles.label}>Start</AppText>
            <AppText style={styles.value}>{candidate.startDate || '—'}</AppText>
            <AppText style={styles.label}>Venue</AppText>
            <AppText style={styles.value}>{candidate.venueName ?? '—'}</AppText>
            <AppText style={styles.label}>City</AppText>
            <AppText style={styles.value}>{candidate.cityName ?? '—'}</AppText>
          </View>

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Matching</AppText>
            <AppText style={styles.meta}>City: {record.matchedCityId ?? '—'}</AppText>
            <AppText style={styles.label}>Imported venue</AppText>
            <AppText style={styles.meta}>{candidate.venueName ?? '—'}</AppText>
            <AppText style={styles.label}>Matched canonical venue</AppText>
            <AppText style={styles.meta}>
              {matchedVenueName ?? record.matchedVenueId ?? 'Unmatched'}
            </AppText>
            <AppText style={styles.label}>Imported organizer</AppText>
            <AppText style={styles.meta}>{candidate.organizerName ?? '—'}</AppText>
            <AppText style={styles.label}>Matched canonical organizer</AppText>
            <AppText style={styles.meta}>
              {matchedOrganizerName ?? record.matchedOrganizerId ?? 'Unmatched'}
            </AppText>
            <AppText style={styles.label}>Imported artist names</AppText>
            {rawArtistNames.length > 0 ? (
              rawArtistNames.map((name, index) => (
                <AppText key={`${name}-${index}`} style={styles.meta}>
                  {index + 1}. {name}
                </AppText>
              ))
            ) : (
              <AppText style={styles.meta}>—</AppText>
            )}
            <AppText style={styles.label}>Matched canonical artists</AppText>
            {matchedArtistIds.length > 0 ? (
              matchedArtistIds.map((artistId, index) => (
                <AppText key={`${artistId}-${index}`} style={styles.meta}>
                  {index + 1}. {artistId}
                  {index === 0 ? ' (headliner on approve)' : ' (support on approve)'}
                </AppText>
              ))
            ) : (
              <AppText style={styles.meta}>—</AppText>
            )}
            {unmatchedArtistNames.length > 0 ? (
              <>
                <AppText style={styles.label}>Unmatched names</AppText>
                {unmatchedArtistNames.map((name, index) => (
                  <AppText key={`unmatched-${name}-${index}`} style={styles.warning}>
                    {name}
                  </AppText>
                ))}
              </>
            ) : null}
            {duplicateMatchedArtistIds.length > 0 ? (
              <AppText style={styles.warning}>
                Duplicate matched artist IDs were removed: {duplicateMatchedArtistIds.join(', ')}
              </AppText>
            ) : null}
            <AppText style={styles.meta}>
              Genres: {record.matchedGenreIds?.join(', ') || '—'}
            </AppText>
            {record.matchingWarnings?.map((w) => (
              <AppText key={w} style={styles.warning}>{w}</AppText>
            ))}
          </View>

          {record.duplicateScore !== undefined && record.duplicateScore > 0 ? (
            <View style={styles.card}>
              <AppText style={styles.sectionTitle}>Duplicate Detection</AppText>
              <AppText style={styles.meta}>
                Score: {Math.round(record.duplicateScore)}%
              </AppText>
              <AppText style={styles.meta}>
                Suggested event: {record.duplicateEventId ?? '—'}
              </AppText>
              {can('records:duplicate') ? (
                <View style={styles.actions}>
                  <PrimaryButton
                    label="Confirm duplicate"
                    onPress={handleConfirmDuplicate}
                    disabled={acting || !record.duplicateEventId}
                  />
                  <SecondaryButton
                    label="Dismiss & continue"
                    onPress={handleDismissDuplicate}
                    disabled={acting}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Validation</AppText>
            {record.validationErrors?.map((issue) => (
              <AppText key={`${issue.code}-${issue.message}`} style={styles.error}>
                {issue.message}
              </AppText>
            ))}
            {record.validationWarnings?.map((issue) => (
              <AppText key={`${issue.code}-${issue.message}`} style={styles.warning}>
                {issue.message}
              </AppText>
            ))}
            {!record.validationErrors?.length && !record.validationWarnings?.length ? (
              <AppText style={styles.meta}>No validation issues.</AppText>
            ) : null}
          </View>

          <SecondaryButton
            label={showRaw ? 'Hide raw payload' : 'Show raw payload'}
            onPress={() => setShowRaw((v) => !v)}
          />
          {showRaw ? (
            <AppText style={styles.raw}>{JSON.stringify(record.rawPayload, null, 2)}</AppText>
          ) : null}

          <View style={styles.actions}>
            {can('records:approve') ? (
              <PrimaryButton label="Approve" onPress={handleApprove} disabled={acting} />
            ) : null}
            {can('records:reject') ? (
              <SecondaryButton label="Reject" onPress={handleReject} disabled={acting} />
            ) : null}
          </View>

          {record.resultingEventId ? (
            <SecondaryButton
              label={`View event ${record.resultingEventId}`}
              onPress={() => router.push(`/admin/events/${record.resultingEventId}`)}
            />
          ) : null}
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacingRoles.screenHorizontal, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...textRoles.screenTitle, flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: { ...textRoles.sectionTitle },
  label: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  value: { ...textRoles.body },
  meta: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  error: { ...textRoles.metadata, color: colors.live },
  success: { ...textRoles.metadata, color: colors.primary },
  warning: { ...textRoles.metadata, color: colors.warning },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    color: colors.textPrimary,
  },
  raw: {
    ...textRoles.metadata,
    fontFamily: 'monospace',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
  },
  actions: { gap: spacing.sm },
});
