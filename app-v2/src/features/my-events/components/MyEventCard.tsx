import { useRouter } from 'expo-router';
import { Alert, Image, StyleSheet, View } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import type { AdminEventRecord, VenueRecord } from '@/data/types/records';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import {
  buildEventSubmissionStatusRoute,
  getContributorEventEditRoute,
  getContributorEventPreviewRoute,
} from '@/features/create/constants/contributor-event-routes';
import {
  formatIsoToDateInput,
  formatIsoToTimeInput,
} from '@/features/create/utils/event-draft-date-time';
import { isPersistableImageUrl } from '@/features/create/utils/event-image-url';
import { resolveEventVenueDisplay } from '@/features/create/utils/event-venue-display';
import type { EventSubmission } from '@/features/create/wizard/wizard-types';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { AdminEventStatusBadge } from '@/features/my-events/components/AdminEventStatusBadge';

export interface MyEventCardProps {
  event: AdminEventRecord;
  venues: VenueRecord[];
  submission?: EventSubmission | null;
  onWithdraw?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
  onResubmit?: (eventId: string) => void;
  withdrawing?: boolean;
  deleting?: boolean;
  resubmitting?: boolean;
}

export function MyEventCard({
  event,
  venues,
  submission,
  onWithdraw,
  onDelete,
  onResubmit,
  withdrawing,
  deleting,
  resubmitting,
}: MyEventCardProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const venue = resolveEventVenueDisplay(event, venues);
  const coverUri = isPersistableImageUrl(event.imageUrl) ? event.imageUrl : undefined;
  const date = formatIsoToDateInput(event.startDate);
  const time = formatIsoToTimeInput(event.startDate);
  const statusRoute = buildEventSubmissionStatusRoute(submission?.id ?? event.id);

  const confirmDelete = () => {
    Alert.alert(t('profile.myEvents.delete.confirmTitle'), t('profile.myEvents.delete.confirmDescription'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('profile.myEvents.delete.confirmAction'),
        style: 'destructive',
        onPress: () => onDelete?.(event.id),
      },
    ]);
  };

  return (
    <View style={styles.card} accessibilityRole="summary">
      {coverUri ? (
        <Image
          accessibilityLabel={event.title}
          source={{ uri: coverUri }}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.coverPlaceholder}>
          <AppText style={styles.placeholderText}>{t('profile.myEvents.noCover')}</AppText>
        </View>
      )}

      <View style={styles.content}>
        <AppText style={styles.title}>{event.title}</AppText>
        <AdminEventStatusBadge status={event.status} />
        <AppText style={styles.meta}>
          {date} · {time}
        </AppText>
        <AppText style={styles.meta}>
          {venue.label}
          {venue.isSuggestion ? ` (${t('events.venue.suggestion')})` : ''}
        </AppText>
        <AppText style={styles.updated}>
          {t('profile.myEvents.updatedAt', {
            date: formatIsoToDateInput(event.updatedAt),
          })}
        </AppText>

        <View style={styles.actions}>
          {event.status === 'draft' ? (
            <>
              <PrimaryButton
                label={t('events.actions.edit')}
                onPress={() => router.push(getContributorEventEditRoute(event.id))}
              />
              <SecondaryButton
                label={t('events.actions.preview')}
                onPress={() => router.push(getContributorEventPreviewRoute(event.id))}
              />
              <SecondaryButton
                label={deleting ? t('profile.myEvents.delete.deleting') : t('profile.myEvents.delete.action')}
                onPress={confirmDelete}
                disabled={deleting}
              />
            </>
          ) : null}

          {event.status === 'review' ? (
            <>
              <PrimaryButton
                label={t('profile.myEvents.actions.viewStatus')}
                onPress={() => router.push(statusRoute)}
              />
              <SecondaryButton
                label={t('events.actions.preview')}
                onPress={() => router.push(getContributorEventPreviewRoute(event.id))}
              />
              <SecondaryButton
                label={withdrawing ? t('events.actions.withdrawing') : t('events.actions.withdraw')}
                onPress={() => onWithdraw?.(event.id)}
                disabled={withdrawing}
              />
            </>
          ) : null}

          {event.status === 'rejected' ? (
            <>
              <PrimaryButton
                label={t('events.actions.edit')}
                onPress={() => router.push(getContributorEventEditRoute(event.id))}
              />
              <SecondaryButton
                label={resubmitting ? t('profile.myEvents.resubmit.submitting') : t('profile.myEvents.resubmit.action')}
                onPress={() => onResubmit?.(event.id)}
                disabled={resubmitting}
              />
              <SecondaryButton
                label={t('profile.myEvents.actions.viewStatus')}
                onPress={() => router.push(statusRoute)}
              />
            </>
          ) : null}

          {event.status === 'published' ? (
            <>
              <PrimaryButton
                label={t('events.actions.viewPublic')}
                onPress={() => router.push(`/event/${event.id}`)}
              />
              <SecondaryButton
                label={t('profile.myEvents.actions.viewStatus')}
                onPress={() => router.push(statusRoute)}
              />
              <GhostButton
                label={t('profile.myEvents.actions.duplicateSoon')}
                onPress={() => undefined}
                disabled
              />
              <GhostButton
                label={t('profile.myEvents.actions.archiveSoon')}
                onPress={() => undefined}
                disabled
              />
            </>
          ) : null}

          {event.status === 'archived' ? (
            <>
              <PrimaryButton
                label={t('profile.myEvents.actions.viewStatus')}
                onPress={() => router.push(statusRoute)}
              />
              <SecondaryButton
                label={t('events.actions.preview')}
                onPress={() => router.push(getContributorEventPreviewRoute(event.id))}
              />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surface,
  },
  coverPlaceholder: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  placeholderText: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  content: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
  },
  meta: {
    ...textRoles.body,
    color: colors.textSecondary,
  },
  updated: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
