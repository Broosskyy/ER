import { Image, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FavoriteButton } from '@/components/buttons/FavoriteButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { CategoryChip } from '@/components/discovery/CategoryChip';
import { TicketPriceLabel } from '@/components/discovery/TicketPriceLabel';
import { AppText } from '@/components/layout/AppText';
import { BottomSheet } from '@/components/overlay/BottomSheet';
import { spacing } from '@/design/spacing';
import { formatEventDateTime } from '@/features/events';
import { resolvePublicTicketPresentation } from '@/features/events/formatting/ticket-presentation';

import type { MapEvent } from '../types/discovery-models';

export interface MapEventPreviewBottomSheetProps {
  visible: boolean;
  event?: MapEvent;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}

export function MapEventPreviewBottomSheet({
  visible,
  event,
  isFavorite,
  onToggleFavorite,
  onClose,
}: MapEventPreviewBottomSheetProps) {
  const router = useRouter();

  if (!event) {
    return null;
  }

  const handleShare = async () => {
    await Share.share({
      message: `${event.title} · ${formatEventDateTime(event.event)}`,
    });
  };

  const ticket = resolvePublicTicketPresentation(event.event);

  return (
    <BottomSheet
      visible={visible}
      title="Event Vorschau"
      onClose={onClose}
      testID="map-event-preview-sheet"
      footer={
        <View style={styles.footer}>
          <SecondaryButton label="Tickets" onPress={() => undefined} style={styles.footerButton} />
          <PrimaryButton
            label="Event öffnen"
            onPress={() => {
              onClose();
              router.push(`/event/${event.id}`);
            }}
            style={styles.footerButton}
          />
        </View>
      }
    >
      <Image source={event.image} style={styles.hero} resizeMode="cover" />
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <AppText role="titleMedium">{event.title}</AppText>
          <AppText role="bodyMuted">
            {formatEventDateTime(event.event)}
            {event.distanceLabel ? ` · ${event.distanceLabel}` : ''}
          </AppText>
          <AppText role="body">
            {event.venueLabel}, {event.cityLabel}
          </AppText>
          {ticket.ticketLabel ? (
            <TicketPriceLabel label={ticket.ticketLabel} colorToken={ticket.colorToken} />
          ) : null}
        </View>
        <FavoriteButton
          active={isFavorite}
          onPress={onToggleFavorite}
          accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        />
      </View>
      <View style={styles.chips}>
        {event.genreLabels.map((genre) => (
          <CategoryChip key={genre} label={genre} />
        ))}
      </View>
      <SecondaryButton label="Teilen" onPress={handleShare} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: 180,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  titleWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
});
