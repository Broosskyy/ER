import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen, AppText } from '@/components';
import { colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import {
  BottomTicketCTA,
  EventDetailHero,
  EventGenreChips,
  EventInfoRow,
  EventNotFoundState,
  EventSection,
  ExpandableDescription,
  LineupList,
  LocationSection,
  openEventInMaps,
  openEventTicketUrl,
  shareEvent,
} from '@/features/event-detail';
import {
  formatEventDateTime,
  getDemoEventById,
} from '@/features/events/data/demo-events';
import { useFavorites } from '@/features/favorites';

const TICKET_CTA_HEIGHT = componentSize.buttonHeight + spacing.md * 2 + 1;

export default function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Array.isArray(id) ? id[0] : id;
  const event = eventId ? getDemoEventById(eventId) : undefined;
  const { isFavorite, toggleFavorite } = useFavorites();

  const hasTicketAction = Boolean(event?.ticketUrl);
  const scrollBottomPadding = useMemo(() => {
    if (hasTicketAction) {
      return TICKET_CTA_HEIGHT + Math.max(insets.bottom, spacing.md);
    }

    return Math.max(insets.bottom, spacing.lg);
  }, [hasTicketAction, insets.bottom]);

  const handleShare = useCallback(async () => {
    if (!event) {
      return;
    }

    try {
      await shareEvent(event);
    } catch {
      // Share sheet dismissed or unavailable — no crash.
    }
  }, [event]);

  const handleOpenMaps = useCallback(async () => {
    if (!event) {
      return;
    }

    const opened = await openEventInMaps(event);

    if (!opened) {
      Alert.alert('Maps unavailable', 'Could not open maps for this location.');
    }
  }, [event]);

  const handleOpenTickets = useCallback(async () => {
    if (!event?.ticketUrl) {
      return;
    }

    const opened = await openEventTicketUrl(event.ticketUrl);

    if (!opened) {
      Alert.alert('Tickets unavailable', 'Could not open the ticket link.');
    }
  }, [event]);

  if (!event) {
    return (
      <AppScreen>
        <EventNotFoundState onGoBack={() => router.back()} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
      >
        <EventDetailHero
          event={event}
          isFavorite={isFavorite(event.id)}
          onBack={() => router.back()}
          onShare={handleShare}
          onToggleFavorite={() => toggleFavorite(event.id)}
        />

        <View style={styles.content}>
          <AppText style={styles.title}>{event.title}</AppText>

          <EventInfoRow
            icon="calendar-outline"
            label="Date & time"
            value={formatEventDateTime(event)}
          />

          <EventInfoRow
            icon="location-outline"
            label="Venue"
            value={`${event.venue}, ${event.city}`}
          />

          {event.priceText ? (
            <EventInfoRow icon="pricetag-outline" label="Price" value={event.priceText} />
          ) : null}

          <EventGenreChips genres={event.genres} />

          {event.lineup && event.lineup.length > 0 ? (
            <EventSection title="Line-up">
              <LineupList artists={event.lineup} />
            </EventSection>
          ) : null}

          {event.description ? (
            <EventSection title="About">
              <ExpandableDescription text={event.description} />
            </EventSection>
          ) : null}

          <EventSection title="Location">
            <LocationSection event={event} onOpenMaps={handleOpenMaps} />
          </EventSection>

          {event.ageRestriction ? (
            <EventInfoRow icon="id-card-outline" label="Age" value={event.ageRestriction} />
          ) : null}

          {event.organizer ? (
            <EventInfoRow icon="people-outline" label="Organizer" value={event.organizer} />
          ) : null}

          {event.sourceName ? (
            <EventInfoRow icon="information-circle-outline" label="Source" value={event.sourceName} />
          ) : null}
        </View>
      </ScrollView>

      <BottomTicketCTA ticketUrl={event.ticketUrl} onPressTickets={handleOpenTickets} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    ...textRoles.screenTitle,
    color: colors.textPrimary,
  },
});
