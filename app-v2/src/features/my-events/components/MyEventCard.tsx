import { useRouter } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { AdminEventRecord } from '@/data/types/records';
import {
  getContributorEventEditRoute,
  getContributorEventPreviewRoute,
} from '@/features/create/constants/contributor-event-routes';
import {
  formatIsoToDateInput,
  formatIsoToTimeInput,
} from '@/features/create/utils/event-draft-date-time';
import { isPersistableImageUrl } from '@/features/create/utils/event-image-url';
import { resolveEventVenueDisplay } from '@/features/create/utils/event-venue-display';
import { useEventStatusLabel } from '@/features/my-events/hooks/useEventStatusLabel';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import type { VenueRecord } from '@/data/types/records';

export interface MyEventCardProps {
  event: AdminEventRecord;
  venues: VenueRecord[];
  onWithdraw?: (eventId: string) => void;
  withdrawing?: boolean;
}

export function MyEventCard({ event, venues, onWithdraw, withdrawing }: MyEventCardProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const statusLabel = useEventStatusLabel(event.status);
  const venue = resolveEventVenueDisplay(event, venues);
  const coverUri = isPersistableImageUrl(event.imageUrl) ? event.imageUrl : undefined;
  const date = formatIsoToDateInput(event.startDate);
  const time = formatIsoToTimeInput(event.startDate);

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
        <View style={styles.statusChip} accessibilityLabel={`${t('events.status.label')}: ${statusLabel}`}>
          <AppText style={styles.statusText}>{statusLabel}</AppText>
        </View>
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
            </>
          ) : null}

          {event.status === 'review' ? (
            <>
              <PrimaryButton
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

          {event.status === 'published' ? (
            <PrimaryButton
              label={t('events.actions.viewPublic')}
              onPress={() => router.push(`/event/${event.id}`)}
            />
          ) : null}

          {event.status === 'rejected' ? (
            <AppText style={styles.rejectedHint}>{t('profile.myEvents.rejectedHint')}</AppText>
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
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusText: {
    ...textRoles.metadata,
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
  rejectedHint: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
});
