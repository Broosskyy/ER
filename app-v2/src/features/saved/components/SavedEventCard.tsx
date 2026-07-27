import { memo } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextButton } from '@/components/buttons/TextButton';
import { EventStatusBadge, TicketStatusBadge } from '@/components/discovery/EventStatusBadge';
import { AppText } from '@/components/layout/AppText';
import { spacing, spacingRoles } from '@/design/spacing';
import { EventDiscoveryCard } from '@/features/events';
import { openEventTicketUrl } from '@/features/event-detail';
import { formatEventDateTime } from '@/features/events';
import type { SavedEvent } from '@/features/saved/types/saved-event';
import {
  formatSavedAtLabel,
  resolveSavedConsumerStatus,
  resolveSavedTicketStatus,
} from '@/features/saved/utils/saved-presentation';

export interface SavedEventCardProps {
  item: SavedEvent;
  isFavorite: boolean;
  onToggleFavorite: (eventId: string) => void;
}

export const SavedEventCard = memo(function SavedEventCard({
  item,
  isFavorite,
  onToggleFavorite,
}: SavedEventCardProps) {
  const consumerStatus = resolveSavedConsumerStatus(item.event);
  const ticketStatus = resolveSavedTicketStatus(item.event);
  const ticketDisabled =
    consumerStatus === 'cancelled' || consumerStatus === 'sold_out' || item.unavailable;

  const handleShare = async () => {
    await Share.share({
      message: `${item.event.title} · ${formatEventDateTime(item.event)}`,
    });
  };

  return (
    <View style={styles.container} testID={`saved-event-${item.eventId}`}>
      {item.unavailable ? (
        <View style={styles.notice}>
          <AppText role="bodyMuted">Dieses Event ist nicht mehr verfügbar.</AppText>
        </View>
      ) : null}
      {consumerStatus &&
      consumerStatus !== 'unavailable' &&
      consumerStatus !== 'upcoming' ? (
        <View style={styles.statusRow}>
          <EventStatusBadge status={consumerStatus} showIcon />
        </View>
      ) : null}
      <EventDiscoveryCard
        event={item.event}
        variant="compactPremium"
        saved={isFavorite}
        onFavoritePress={() => onToggleFavorite(item.eventId)}
      />
      <View style={styles.metaRow}>
        <AppText role="caption">{formatSavedAtLabel(item.savedAt)}</AppText>
        {ticketStatus ? <TicketStatusBadge status={ticketStatus} /> : null}
      </View>
      <View style={styles.actions}>
        <TextButton label="Teilen" onPress={() => void handleShare()} />
        <SecondaryButton
          label="Tickets"
          disabled={ticketDisabled || !item.event.ticketUrl}
          onPress={() => {
            if (item.event.ticketUrl) {
              void openEventTicketUrl(item.event.ticketUrl);
            }
          }}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  notice: {
    paddingVertical: spacing.xs,
  },
  statusRow: {
    alignSelf: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
});
