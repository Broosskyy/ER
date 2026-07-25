import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
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
  cityRepository,
  genreRepository,
  venueRepository,
} from '@/data/repositories/registry';
import {
  AdminErrorState,
  AdminLoadingState,
} from '@/features/admin/components/AdminStates';
import { adminPageLayoutStyles } from '@/features/admin/admin-page-layout';
import { canModerateContributorEvents } from '@/features/admin/admin-permissions';
import { useAdminAuth } from '@/features/admin/AdminAuthContext';

const REVIEW_QUEUE_ROUTE = '/admin/events/review' as const;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText style={styles.detailLabel}>{label}</AppText>
      <AppText style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

export default function ContributorReviewDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, role } = useAdminAuth();
  const canModerate = canModerateContributorEvents(role);
  const [record, setRecord] = useState<AdminEventRecord | null>(null);
  const [genreLabel, setGenreLabel] = useState('—');
  const [cityLabel, setCityLabel] = useState('—');
  const [venueLabel, setVenueLabel] = useState('—');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    if (!session) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [event, genres, cities, venues] = await Promise.all([
        adminEventModerationService.getReviewEvent(session, id),
        genreRepository.getActive(),
        cityRepository.getActive(),
        venueRepository.getAll(),
      ]);

      setRecord(event);
      setGenreLabel(genres.find((genre) => genre.id === event.genreId)?.name ?? '—');
      setCityLabel(cities.find((city) => city.id === event.cityId)?.name ?? '—');

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

  const handlePublish = async () => {
    if (!session || !record || !canModerate) {
      return;
    }

    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      await adminEventModerationService.publishContributorEvent(session, record.id);
      navigateToQueue('Event published successfully.');
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
    setSuccess(null);
    try {
      await adminEventModerationService.rejectContributorEvent(session, record.id, rejectNote);
      navigateToQueue('Event rejected.');
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

    return <AdminLoadingState label="Loading submission…" />;
  }

  return (
    <AppScreen>
      <SafeAreaContainer style={styles.container}>
        <ScrollView style={adminPageLayoutStyles.flexScroll} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SecondaryButton label="Back" onPress={() => router.back()} />
            <AppText style={styles.title}>Review Submission</AppText>
          </View>

          <AppText style={styles.statusBadge}>Status: review</AppText>

          {record.imageUrl ? (
            <Image source={{ uri: record.imageUrl }} style={styles.coverImage} resizeMode="cover" />
          ) : null}

          <DetailRow label="Title" value={record.title} />
          <DetailRow label="Start" value={new Date(record.startDate).toLocaleString('de-DE')} />
          {record.endDate ? (
            <DetailRow label="End" value={new Date(record.endDate).toLocaleString('de-DE')} />
          ) : null}
          <DetailRow label="Genre" value={genreLabel} />
          <DetailRow label="City" value={cityLabel} />
          <DetailRow label="Venue" value={venueLabel} />
          <DetailRow label="Contributor" value={record.createdBy ?? '—'} />
          <DetailRow label="Description" value={record.description || '—'} />

          {record.ticketUrl ? <DetailRow label="Tickets" value={record.ticketUrl} /> : null}
          {record.websiteUrl ? <DetailRow label="Website" value={record.websiteUrl} /> : null}
          {record.instagramUrl ? <DetailRow label="Instagram" value={record.instagramUrl} /> : null}
          {record.facebookUrl ? <DetailRow label="Facebook" value={record.facebookUrl} /> : null}

          {record.flyerUrl ? (
            <Image source={{ uri: record.flyerUrl }} style={styles.flyerImage} resizeMode="contain" />
          ) : null}

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {success ? <AppText style={styles.success}>{success}</AppText> : null}

          {canModerate ? (
            <View style={styles.actions}>
              <PrimaryButton
                label={acting ? 'Publishing…' : 'Publish'}
                onPress={handlePublish}
                disabled={acting}
              />
              <AppText style={styles.section}>Reject (optional note)</AppText>
              <TextInput
                value={rejectNote}
                onChangeText={setRejectNote}
                placeholder="Reason for rejection (internal audit only)…"
                placeholderTextColor={colorRoles.emptyStateDescription}
                multiline
                style={[styles.input, styles.multiline]}
              />
              <SecondaryButton
                label={acting ? 'Rejecting…' : 'Reject'}
                onPress={handleReject}
                disabled={acting}
              />
            </View>
          ) : (
            <AppText style={styles.readOnlyNotice}>
              Your role can view submissions but cannot publish or reject.
            </AppText>
          )}

          <SecondaryButton
            label="Open in event editor"
            onPress={() => router.push(`/admin/events/${record.id}`)}
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
    textTransform: 'capitalize',
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
  section: { ...textRoles.metadata, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  actions: { gap: spacing.sm },
  readOnlyNotice: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  error: { ...textRoles.metadata, color: colors.live },
  success: { ...textRoles.metadata, color: colors.primary },
});
