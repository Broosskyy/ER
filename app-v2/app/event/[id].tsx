import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen } from '@/components';
import { CategoryChip } from '@/components/discovery/CategoryChip';
import { EventActionBar } from '@/components/event-detail/EventActionBar';
import {
  EventDetailErrorState,
  EventDetailSkeleton,
} from '@/components/event-detail/EventDetailStates';
import { EventNoticeBanner } from '@/components/event-detail/EventNoticeBanner';
import { EventHero } from '@/components/event-detail/EventHero';
import { EventInfoSection } from '@/components/event-detail/EventInfoSection';
import { EventTicketSection } from '@/components/event-detail/EventTicketSection';
import { LineupSection } from '@/components/event-detail/LineupSection';
import { TimetableSection } from '@/components/event-detail/TimetableSection';
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
import { trackEventDetailTelemetry } from '@/features/event-detail/feed/event-detail-telemetry';
import { useEventDetail } from '@/features/event-detail/hooks/useEventDetail';
import { useEventDetailEntities } from '@/features/event-detail/hooks/useEventDetailEntities';
import {
  toEventHeroViewModel,
  toEventInfoViewModel,
  toEventNoticeViewModel,
  toEventTicketSectionViewModel,
  toLineupSectionViewModel,
  toOrganizerDetailViewModel,
  toTimetableSectionViewModel,
  toVenueDetailViewModel,
} from '@/features/event-detail/utils/event-detail-view-model';
import { getSourceDisplayLabel } from '@/features/events/data/demo-images';
import { isTicketActionDisabled } from '@/features/events/status/event-status-resolver';
import { useFavoriteToggle } from '@/features/favorites';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useEntityFollow } from '@/features/profiles/hooks/useEntityFollow';
import {
  artistProfileRoute,
  organizerProfileRoute,
  venueProfileRoute,
} from '@/features/profiles/routes/entity-profile-routes';
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

  const {
    event,
    similarEvents,
    loading,
    similarLoading,
    error,
    errorKind,
    isOnline,
    fromCache,
    retry,
  } = useEventDetail(eventId);

  const { entities } = useEventDetailEntities(event);
  const { isFavorite, toggleFavorite, isHydrated } = useFavoriteToggle(
    eventId ? `/event/${eventId}` : undefined,
  );
  const organizerFollow = useEntityFollow({
    entityType: 'organizer',
    entityId: entities.organizer?.id ?? event?.organizerId,
  });

  const hero = useMemo(() => (event ? toEventHeroViewModel(event) : undefined), [event]);
  const info = useMemo(() => (event ? toEventInfoViewModel(event) : undefined), [event]);
  const lineup = useMemo(() => (event ? toLineupSectionViewModel(event, entities) : undefined), [entities, event]);
  const timetable = useMemo(() => (event ? toTimetableSectionViewModel(event) : undefined), [event]);
  const venue = useMemo(
    () => (event ? toVenueDetailViewModel(event, entities) : undefined),
    [entities, event],
  );
  const organizer = useMemo(
    () => (event ? toOrganizerDetailViewModel(event, entities) : undefined),
    [entities, event],
  );
  const ticketSection = useMemo(
    () => (event ? toEventTicketSectionViewModel(event) : undefined),
    [event],
  );
  const notice = useMemo(() => (event ? toEventNoticeViewModel(event) : undefined), [event]);

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
      trackEventDetailTelemetry('detail_share', { eventId: event.id });
      await shareEvent(event);
    } catch {
      // Share dismissed or failed silently.
    }
  }, [event]);

  const handleToggleFavorite = useCallback(() => {
    if (!event) {
      return;
    }

    const willSave = !isFavorite(event.id);
    trackEventDetailTelemetry(willSave ? 'detail_favorite_set' : 'detail_favorite_remove', {
      eventId: event.id,
    });
    toggleFavorite(event.id);
  }, [event, isFavorite, toggleFavorite]);

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

    trackEventDetailTelemetry('detail_ticket_cta', { eventId: event.id });
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

  const handleOrganizerPress = useCallback(() => {
    const organizerId = entities.organizer?.id ?? event?.organizerId;
    if (!organizer?.profileNavigable || !organizerId) {
      return;
    }
    router.push(organizerProfileRoute(organizerId) as Href);
  }, [entities.organizer?.id, event?.organizerId, organizer?.profileNavigable, router]);

  const handleVenuePress = useCallback(() => {
    const venueId = entities.venue?.id ?? event?.venueId;
    if (!venue?.profileNavigable || !venueId) {
      return;
    }
    router.push(venueProfileRoute(venueId) as Href);
  }, [entities.venue?.id, event?.venueId, router, venue?.profileNavigable]);

  const handleArtistPress = useCallback(
    (artistId: string) => {
      router.push(artistProfileRoute(artistId) as Href);
    },
    [router],
  );

  const handleSimilarEventPress = useCallback(
    (similarEventId: string) => {
      trackEventDetailTelemetry('detail_similar_opened', { eventId: similarEventId });
      router.push(`/event/${similarEventId}`);
    },
    [router],
  );

  if (loading && !event) {
    return (
      <AppScreen>
        <ResponsiveScreen style={styles.loadingFrame}>
          <EventDetailSkeleton />
        </ResponsiveScreen>
      </AppScreen>
    );
  }

  if (error || !event || !hero || !info || !ticketSection || !venue) {
    if (errorKind === 'not_found' || errorKind === 'archived') {
      return (
        <AppScreen>
          <EventNotFoundState onGoBack={() => router.back()} />
        </AppScreen>
      );
    }

    return (
      <AppScreen>
        <ResponsiveScreen style={styles.loadingFrame}>
          <EventDetailErrorState
            title={!isOnline ? 'Offline' : 'Event konnte nicht geladen werden'}
            message={
              error ??
              (!isOnline
                ? fromCache
                  ? 'Offline-Modus mit zwischengespeicherten Daten.'
                  : 'Keine Internetverbindung und keine zwischengespeicherten Daten.'
                : 'Bitte versuche es erneut.')
            }
            onRetry={() => void retry()}
          />
        </ResponsiveScreen>
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
            onSavePress={handleToggleFavorite}
          />

          <View style={styles.content}>
            <EventActionBar
              saved={isHydrated && isFavorite(event.id)}
              onSavePress={handleToggleFavorite}
              onSharePress={handleShare}
              onDirectionsPress={hasMapsAction ? handleOpenMaps : undefined}
            />

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

            <LineupSection lineup={lineup!} onArtistPress={handleArtistPress} />

            <TimetableSection timetable={timetable!} />

            <VenueDetailCard
              venue={venue}
              onPress={venue.profileNavigable ? handleVenuePress : undefined}
              onDirectionsPress={hasMapsAction ? handleOpenMaps : undefined}
            />

            {organizer ? (
              <OrganizerDetailCard
                detail={organizer}
                followState={organizer.profileNavigable ? organizerFollow.followState : undefined}
                onFollowPress={
                  organizer.profileNavigable ? () => void organizerFollow.toggle() : undefined
                }
                onPress={organizer.profileNavigable ? handleOrganizerPress : undefined}
              />
            ) : null}

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
              loading={similarLoading}
              onEventPress={handleSimilarEventPress}
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
  loadingFrame: {
    flex: 1,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.lg,
  },
  content: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.lg,
    gap: spacing.xl,
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
