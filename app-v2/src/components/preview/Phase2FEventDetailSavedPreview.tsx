import { useState } from 'react';
import { View } from 'react-native';

import { EventActionBar } from '@/components/event-detail/EventActionBar';
import { EventDetailErrorState, EventDetailSkeleton } from '@/components/event-detail/EventDetailStates';
import { EventHero } from '@/components/event-detail/EventHero';
import { EventInfoSection } from '@/components/event-detail/EventInfoSection';
import { EventNoticeBanner } from '@/components/event-detail/EventNoticeBanner';
import { EventTicketSection } from '@/components/event-detail/EventTicketSection';
import { ExpandableText } from '@/components/event-detail/ExpandableText';
import { LineupSection } from '@/components/event-detail/LineupSection';
import { OrganizerDetailCard } from '@/components/event-detail/OrganizerDetailCard';
import { SimilarEventsSection } from '@/components/event-detail/SimilarEventsSection';
import { VenueDetailCard } from '@/components/event-detail/VenueDetailCard';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { RemoveSavedDialog } from '@/components/saved/RemoveSavedDialog';
import { SavedEmptyState } from '@/components/saved/SavedEmptyState';
import { SavedEventCard } from '@/components/saved/SavedEventCard';
import { SavedFilterBar } from '@/components/saved/SavedFilterBar';
import { SavedSectionHeader } from '@/components/saved/SavedSectionHeader';
import { SavedSortSelector } from '@/components/saved/SavedSortSelector';

import {
  cancelledHero,
  cancelledNotice,
  emptyPastSaved,
  emptySaved,
  externalTicketSection,
  freeRsvpTicketSection,
  longDescription,
  nativeTicketSection,
  postponedHero,
  savedClubNight,
  savedFilters,
  savedPastEvent,
  savedSection,
  savedSortOptions,
  savedVoidEvent,
  similarEvents,
  sisyphosVenue,
  soldOutHero,
  soldOutTicketSection,
  tbaLineup,
  venueChangedNotice,
  voidEventInfo,
  voidHero,
  voidLineup,
  voidOrganizerDetail,
} from './phase-2f-fixtures';
import { PreviewThemeFrame } from './PreviewThemeFrame';

function EventDetailShowcase() {
  return (
    <Stack gap="xl">
      <Section title="EventHero">
        <EventHero event={voidHero} saved onBackPress={() => undefined} onSharePress={() => undefined} onSavePress={() => undefined} />
        <EventHero event={soldOutHero} onSharePress={() => undefined} onSavePress={() => undefined} />
        <EventHero event={cancelledHero} saved onSavePress={() => undefined} />
        <EventHero event={postponedHero} />
      </Section>
      <Section title="EventActionBar & Info">
        <EventActionBar saved onSavePress={() => undefined} onSharePress={() => undefined} onMorePress={() => undefined} />
        <EventInfoSection info={voidEventInfo} title="Beschreibung" />
        <ExpandableText text={longDescription} />
      </Section>
      <Section title="Line-up, Venue & Organizer">
        <LineupSection lineup={voidLineup} />
        <LineupSection lineup={tbaLineup} />
        <VenueDetailCard venue={sisyphosVenue} onDirectionsPress={() => undefined} />
        <OrganizerDetailCard detail={voidOrganizerDetail} followState="follow" onFollowPress={() => undefined} />
      </Section>
      <Section title="Tickets & Notices">
        <EventTicketSection section={nativeTicketSection} onCtaPress={() => undefined} />
        <EventTicketSection section={externalTicketSection} onCtaPress={() => undefined} />
        <EventTicketSection section={freeRsvpTicketSection} onCtaPress={() => undefined} />
        <EventTicketSection section={soldOutTicketSection} />
        <EventNoticeBanner notice={cancelledNotice} />
        <EventNoticeBanner notice={venueChangedNotice} />
      </Section>
      <Section title="Similar & States">
        <SimilarEventsSection similar={similarEvents} onEventPress={() => undefined} />
        <EventDetailSkeleton />
        <EventDetailErrorState onRetry={() => undefined} />
      </Section>
    </Stack>
  );
}

function SavedShowcase() {
  const [dialogVisible, setDialogVisible] = useState(false);

  return (
    <Stack gap="xl">
      <Section title="Saved List">
        <SavedSectionHeader section={savedSection} onSortPress={() => undefined} />
        <SavedFilterBar filters={savedFilters} onSelect={() => undefined} />
        <SavedSortSelector options={savedSortOptions} />
        <SavedEventCard event={savedVoidEvent} onPress={() => undefined} onFavoritePress={() => undefined} onMorePress={() => setDialogVisible(true)} />
        <SavedEventCard event={savedClubNight} onPress={() => undefined} onFavoritePress={() => undefined} />
        <SavedEventCard event={savedPastEvent} onPress={() => undefined} onFavoritePress={() => undefined} />
      </Section>
      <Section title="Saved Empty & Dialog">
        <SavedEmptyState empty={emptySaved} />
        <SavedEmptyState empty={emptyPastSaved} />
        <RemoveSavedDialog
          visible={dialogVisible}
          eventTitle={savedVoidEvent.title}
          onConfirm={() => setDialogVisible(false)}
          onCancel={() => setDialogVisible(false)}
        />
      </Section>
    </Stack>
  );
}

export function Phase2FEventDetailSavedPreview() {
  return (
    <Section
      title="Sprint 2A Phase 2F – Event Detail & Saved Components"
      subtitle="UI-only event detail and saved presentation — no navigation, APIs, or persistence"
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <PreviewThemeFrame mode="light" label="Light">
          <EventDetailShowcase />
          <SavedShowcase />
        </PreviewThemeFrame>
        <PreviewThemeFrame mode="dark" label="Dark">
          <EventDetailShowcase />
          <SavedShowcase />
        </PreviewThemeFrame>
      </View>
    </Section>
  );
}
