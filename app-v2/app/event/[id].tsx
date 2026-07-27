import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen } from '@/components';
import { CategoryChip } from '@/components/discovery/CategoryChip';
import { EventNoticeBanner } from '@/components/event-detail/EventNoticeBanner';
import { EventHero } from '@/components/event-detail/EventHero';
import { EventInfoSection } from '@/components/event-detail/EventInfoSection';
import { EventTicketSection } from '@/components/event-detail/EventTicketSection';
import { LineupSection } from '@/components/event-detail/LineupSection';
import { OrganizerDetailCard } from '@/components/event-detail/OrganizerDetailCard';
import { SimilarEventsSection } from '@/components/event-detail/SimilarEventsSection';
import { VenueDetailCard } from '@/components/event-detail/VenueDetailCard';
import { TextButton } from '@/components/buttons/TextButton';
import { spacing, spacingRoles } from '@/design/spacing';
import {
  EventNotFoundState,
  openEventInMaps,
  openEventTicketUrl,
  shareEvent,
} from '@/features/event-detail';
import {
  toEventHeroViewModel,
  toEventInfoViewModel,
  toEventNoticeViewModel,
  toEventTicketSectionViewModel,
  toLineupSectionViewModel,
  toOrganizerDetailViewModel,
  toSimilarEventCards,
  toVenueDetailViewModel,
} from '@/features/event-detail/utils/event-detail-view-model';
import { eventRepository, toEventDisplayModel } from '@/features/events';
import { getSourceDisplayLabel } from '@/features/events/data/demo-images';
import { isTicketActionDisabled } from '@/features/events/status/event-status-resolver';
import { useFavoriteToggle } from '@/features/favorites';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useScreenBottomInset } from '@/platform/screen-insets';
import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';
import { buildEventJsonLd } from '@/platform/seo/structured-data';
import { useWebSeo } from '@/platform/seo/use-web-seo';

export default function EventDetailScreen() {
  const router = useRouter();
  const bottomInset = useScreenBottomInset();
  const { t } = useAppTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Array.isArray(id) ? id[0] : id;
  const event = useMemo(() => {
    if (!eventId) {
      return undefined;
    }

    const found = eventRepository.getEventById(eventId);
    return found ? toEventDisplayModel(found) : undefined;
  }, [eventId]);
  const { isFavorite, toggleFavorite, isHydrated } = useFavoriteToggle(
    eventId ? `/event/${eventId}` : undefined,
  );

  const hero = useMemo(() => (event ? toEventHeroViewModel(event) : undefined), [event]);
  const info = useMemo(() => (event ? toEventInfoViewModel(event) : undefined), [event]);
  const lineup = useMemo(() => (event ? toLineupSectionViewModel(event) : undefined), [event]);
  const venue = useMemo(() => (event ? toVenueDetailViewModel(event) : undefined), [event]);
  const organizer = useMemo(() => (event ? toOrganizerDetailViewModel(event) : undefined), [event]);
  const ticketSection = useMemo(
    () => (event ? toEventTicketSectionViewModel(event) : undefined),
    [event],
  );
  const notice = useMemo(() => (event ? toEventNoticeViewModel(event) : undefined), [event]);
  const similarEvents = useMemo(() => {
    if (!event) {
      return [];
    }

    return toSimilarEventCards(
      event,
      eventRepository.getPublishedEvents().map(toEventDisplayModel),
    );
  }, [event]);

  useWebSeo({
    title: event ? `${event.title} — Eternal Rave` : WEB_PAGE_TITLES.eventDetail,
    description: event?.description?.slice(0, 160),
    path: eventId ? `/event/${eventId}` : undefined,
    ogType: 'article',
    jsonLd:
      event && eventId
        ? buildEventJsonLd({
            id: event.id,
            title: event.title,
            description: event.description,
            startDate: event.startDateTime,
            endDate: event.endDateTime,
            venueName: event.venue,
            city: event.city,
            ticketUrl: event.ticketUrl,
          })
        : null,
    jsonLdId: 'event-json-ld',
  });

  const scrollBottomPadding = bottomInset + spacing.lg;

  const handleShare = useCallback(async () => {
    if (!event) {
      return;
    }

    try {
      await shareEvent(event);
    } catch {
      // Share dismissed.
    }
  }, [event]);

  const handleOpenMaps = useCallback(async () => {
    if (!event) {
      return;
    }

    const opened = await openEventInMaps(event);

    if (!opened) {
      Alert.alert(
        t('eventDetail.maps.unavailableTitle'),
        t('eventDetail.maps.unavailableMessage'),
      );
    }
  }, [event, t]);

  const handleOpenTickets = useCallback(async () => {
    if (!event?.ticketUrl || isTicketActionDisabled(event)) {
      return;
    }

    const opened = await openEventTicketUrl(event.ticketUrl);

    if (!opened) {
      Alert.alert(
        t('eventDetail.tickets.unavailableTitle'),
        t('eventDetail.tickets.unavailableMessage'),
      );
    }
  }, [event, t]);

  const handleOpenSource = useCallback(async () => {
    if (!event?.sourceUrl) {
      return;
    }

    try {
      await Linking.openURL(event.sourceUrl);
    } catch {
      Alert.alert(
        t('eventDetail.source.unavailableTitle'),
        t('eventDetail.source.unavailableMessage'),
      );
    }
  }, [event, t]);

  const handleReportEvent = useCallback(() => {
    Alert.alert(t('eventDetail.report.title'), t('eventDetail.report.prompt'), [
      { text: t('eventDetail.report.reasons.wrongDate') },
      { text: t('eventDetail.report.reasons.notExists') },
      { text: t('eventDetail.report.reasons.wrongLocation') },
      { text: t('eventDetail.report.reasons.spam') },
      { text: t('eventDetail.report.reasons.other') },
      { text: t('common.actions.cancel'), style: 'cancel' },
    ]);
  }, [t]);

  const handleGenrePress = useCallback(
    (genre: string) => {
      router.push(`/(tabs)/search?genre=${encodeURIComponent(genre.toLowerCase())}`);
    },
    [router],
  );

  if (!event || !hero || !info || !ticketSection || !venue) {
    return (
      <AppScreen>
        <EventNotFoundState onGoBack={() => router.back()} />
      </AppScreen>
    );
  }

  const sourceLabel = getSourceDisplayLabel(event.source);
  const hasMapsAction = Boolean(event.latitude && event.longitude) || Boolean(event.address);
  const hasSourceAction = Boolean(event.sourceUrl);

  return (
    <AppScreen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
      >
        <ResponsiveScreen style={styles.detailFrame}>
          <EventHero
            event={hero}
            saved={isHydrated && isFavorite(event.id)}
            onBackPress={() => router.back()}
            onSharePress={handleShare}
            onSavePress={() => toggleFavorite(event.id)}
          />

          <View style={styles.content}>
            {notice ? <EventNoticeBanner notice={notice} /> : null}

            <View style={styles.genreRow}>
              {event.genres.map((genre) => (
                <CategoryChip
                  key={genre}
                  label={genre}
                  onPress={() => handleGenrePress(genre)}
                />
              ))}
            </View>

            <EventInfoSection info={info} title={t('eventDetail.sections.details')} />

            <EventTicketSection
              section={ticketSection}
              onCtaPress={ticketSection.mode === 'sold_out' ? undefined : handleOpenTickets}
            />

            {lineup ? <LineupSection lineup={lineup} /> : null}

            <VenueDetailCard
              venue={venue}
              onDirectionsPress={hasMapsAction ? handleOpenMaps : undefined}
            />

            {organizer ? <OrganizerDetailCard detail={organizer} /> : null}

            {sourceLabel ? (
              <View style={styles.sourceBlock}>
                <TextButton
                  label={
                    hasSourceAction
                      ? t('eventDetail.source.open', { source: sourceLabel })
                      : `${t('eventDetail.sections.source')}: ${sourceLabel}`
                  }
                  onPress={hasSourceAction ? handleOpenSource : undefined}
                  disabled={!hasSourceAction}
                />
              </View>
            ) : null}

            <TextButton
              label={t('eventDetail.report.action')}
              onPress={handleReportEvent}
              style={styles.reportAction}
            />

            <SimilarEventsSection
              similar={{ title: t('eventDetail.sections.similar'), events: similarEvents }}
              layout="list"
              onEventPress={(similarEventId) => router.push(`/event/${similarEventId}`)}
            />
          </View>
        </ResponsiveScreen>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 0,
    width: '100%',
  },
  detailFrame: {
    flex: 0,
  },
  content: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sourceBlock: {
    alignItems: 'flex-start',
  },
  reportAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
});
