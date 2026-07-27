import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import {
  AdminDecisionBar,
  ReviewReasonField,
  ReviewTimeline,
} from '@/components/admin/AdminReviewComponents';
import { SourceAttributionRow } from '@/components/admin/SourceDuplicateComponents';
import { AppScreen } from '@/components/layout/AppScreen';
import { AppText } from '@/components/layout/AppText';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { getErrorMessage } from '@/core/errors/app-error';
import type { AdminEventRecord } from '@/data/types/records';
import {
  adminEventModerationService,
  adminModerationStateService,
  cityRepository,
  eventModerationAuditService,
  genreRepository,
  venueRepository,
} from '@/data/repositories/registry';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canModerateContributorEvents } from '@/features/admin/admin-permissions';
import { MODERATION_REASON_CODES, MODERATION_REASON_LABELS } from '@/features/admin/constants/moderation-reasons';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';
import type { ModerationQueueStatus, ModerationReasonCode } from '@/features/admin/types/moderation-types';
import { resolveModerationQueueStatus } from '@/features/admin/utils/moderation-status';
import { buildReviewTimeline, resolveQueueStatusLabel } from '@/features/admin/utils/admin-review-mapper';

const REVIEW_QUEUE_ROUTE = '/admin/events/review' as const;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText style={styles.detailLabel}>{label}</AppText>
      <AppText style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

export function ContributorReviewDetailContent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, role } = useAdminAuth();
  const canModerate = canModerateContributorEvents(role);
  const [record, setRecord] = useState<AdminEventRecord | null>(null);
  const [genreLabel, setGenreLabel] = useState('—');
  const [cityLabel, setCityLabel] = useState('—');
  const [venueLabel, setVenueLabel] = useState('—');
  const [queueStatus, setQueueStatus] = useState<ModerationQueueStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<ModerationReasonCode>('incomplete_data');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!session) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [event, genres, cities, venues, state] = await Promise.all([
        adminEventModerationService.getReviewEvent(session, id),
        genreRepository.getActive(),
        cityRepository.getActive(),
        venueRepository.getAll(),
        adminModerationStateService.getState(id),
      ]);

      setRecord(event);
      setGenreLabel(genres.find((genre) => genre.id === event.genreId)?.name ?? '—');
      setCityLabel(cities.find((city) => city.id === event.cityId)?.name ?? '—');
      setQueueStatus(resolveModerationQueueStatus(event, state?.queueStatus));

      if (event.venueId) {
        setVenueLabel(venues.find((venue) => venue.id === event.venueId)?.name ?? event.venueId);
      } else if (event.venueName) {
        setVenueLabel(
          event.venueCity ? `${event.venueName} (${event.venueCity})` : event.venueName,
        );
      } else {
        setVenueLabel('—');
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

  const navigateToQueue = (message: string) => {
    setSuccess(message);
    setTimeout(() => {
      router.replace(REVIEW_QUEUE_ROUTE);
    }, 700);
  };

  const handleMarkInReview = async () => {
    if (!session || !record || !canModerate) {
      return;
    }

    setActing(true);
    setError(null);
    try {
      await adminEventModerationService.markInReview(session, record.id);
      await load();
      setSuccess('Event als „In Prüfung“ markiert.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  const handleApprove = async () => {
    if (!session || !record || !canModerate) {
      return;
    }

    setActing(true);
    setError(null);
    try {
      await adminEventModerationService.approveContributorEvent(session, record.id);
      navigateToQueue('Event genehmigt. Veröffentlichung erfolgt separat.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!session || !record || !canModerate) {
      return;
    }

    setActing(true);
    setError(null);
    try {
      await adminEventModerationService.requestChangesContributorEvent(session, record.id, {
        reasonCode,
        note,
      });
      navigateToQueue('Änderungen angefordert.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!session || !record || !canModerate) {
      return;
    }

    setActing(true);
    setError(null);
    try {
      await adminEventModerationService.rejectContributorEvent(session, record.id, {
        reasonCode,
        note,
      });
      navigateToQueue('Event abgelehnt.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  const handlePublish = async () => {
    if (!session || !record || !canModerate) {
      return;
    }

    setActing(true);
    setError(null);
    try {
      await adminEventModerationService.publishContributorEvent(session, record.id);
      navigateToQueue('Event veröffentlicht.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setActing(false);
    }
  };

  if (loading || !record) {
    if (error) {
      return <AdminErrorState message={error} onRetry={load} />;
    }
    return <AdminLoadingState label="Review wird geladen…" />;
  }

  const timeline = buildReviewTimeline(
    record,
    eventModerationAuditService.listByEvent(record.id),
  );

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Zurück" onPress={() => router.back()} />
            <AppText style={styles.title}>Event-Review</AppText>
          </View>

          <AppText style={styles.statusBadge}>Status: {resolveQueueStatusLabel(queueStatus)}</AppText>

          {record.imageUrl ? (
            <Image source={{ uri: record.imageUrl }} style={styles.coverImage} resizeMode="cover" />
          ) : null}

          <DetailRow label="Titel" value={record.title} />
          <DetailRow label="Start" value={new Date(record.startDate).toLocaleString('de-DE')} />
          {record.endDate ? (
            <DetailRow label="Ende" value={new Date(record.endDate).toLocaleString('de-DE')} />
          ) : null}
          <DetailRow label="Genre" value={genreLabel} />
          <DetailRow label="Stadt" value={cityLabel} />
          <DetailRow label="Venue" value={venueLabel} />
          <DetailRow label="Veranstalter" value={record.createdBy ?? '—'} />
          <DetailRow label="Beschreibung" value={record.description || '—'} />
          {record.ticketUrl ? <DetailRow label="Tickets" value={record.ticketUrl} /> : null}
          {record.websiteUrl ? <DetailRow label="Website" value={record.websiteUrl} /> : null}
          {record.instagramUrl ? <DetailRow label="Instagram" value={record.instagramUrl} /> : null}
          {record.facebookUrl ? <DetailRow label="Facebook" value={record.facebookUrl} /> : null}

          {record.flyerUrl ? (
            <Image source={{ uri: record.flyerUrl }} style={styles.flyerImage} resizeMode="contain" />
          ) : null}

          <SourceAttributionRow
            attribution={{
              sourceLabel: 'Quelle',
              valueLabel: 'Community-Einreichung',
              freshnessLabel: `Eingereicht ${new Date(record.updatedAt).toLocaleString('de-DE')}`,
              accessibilityLabel: 'Quelle Community-Einreichung',
            }}
          />

          <ReviewTimeline timeline={timeline} />

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          {canModerate ? (
            <View style={styles.actions}>
              <AppText role="sectionTitle">Moderationsentscheidung</AppText>
              <ReviewReasonField
                label={`Grund: ${MODERATION_REASON_LABELS[reasonCode]}`}
                placeholder="Zusätzliche Hinweise für den Veranstalter…"
                value={note}
                onChangeText={setNote}
              />
              <View style={styles.reasonRow}>
                {MODERATION_REASON_CODES.slice(0, 4).map((code) => (
                  <SecondaryButton
                    key={code}
                    label={MODERATION_REASON_LABELS[code]}
                    onPress={() => setReasonCode(code)}
                  />
                ))}
              </View>
              <AdminDecisionBar
                approveLabel={acting ? 'Wird gespeichert…' : 'Genehmigen'}
                requestChangesLabel="Änderungen anfordern"
                rejectLabel="Ablehnen"
                onApprovePress={handleApprove}
                onRequestChangesPress={handleRequestChanges}
                onRejectPress={handleReject}
              />
              {queueStatus === 'pending' ? (
                <SecondaryButton
                  label="Als in Prüfung markieren"
                  onPress={() => void handleMarkInReview()}
                  disabled={acting}
                />
              ) : null}
              {queueStatus === 'approved' ? (
                <PrimaryButton
                  label={acting ? 'Veröffentlicht…' : 'Veröffentlichen'}
                  onPress={() => void handlePublish()}
                  disabled={acting}
                />
              ) : null}
              <SecondaryButton
                label="Dubletten prüfen"
                onPress={() => router.push(`/admin/events/review/${record.id}/duplicates`)}
                disabled={acting}
              />
            </View>
          ) : (
            <AppText style={styles.readOnlyNotice}>
              Deine Rolle kann Einreichungen nur ansehen.
            </AppText>
          )}

          <SecondaryButton
            label="Im Event-Editor öffnen"
            onPress={() => router.push(`/admin/events/${record.id}`)}
            disabled={acting}
          />
          {record.createdBy ? (
            <SecondaryButton
              label="Veranstalter-Profil"
              onPress={() => router.push('/profile/organizer')}
              disabled={acting}
            />
          ) : null}
          <SecondaryButton
            label="Öffentliche Eventseite"
            onPress={() => router.push(`/event/${record.id}`)}
            disabled={acting}
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
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { ...textRoles.sectionTitle, flex: 1 },
  statusBadge: {
    ...textRoles.metadata,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  coverImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  flyerImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  detailRow: { gap: spacing.xs },
  detailLabel: { ...textRoles.metadata, color: colorRoles.emptyStateDescription },
  detailValue: { ...textRoles.metadata, color: colors.textPrimary },
  actions: { gap: spacing.sm },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  readOnlyNotice: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  error: { ...textRoles.metadata, color: colors.live },
  success: { ...textRoles.metadata, color: colors.primary },
});
