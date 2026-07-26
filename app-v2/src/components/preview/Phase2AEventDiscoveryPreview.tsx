import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/feedback/Skeleton';
import { AppText } from '@/components/layout/AppText';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';
import { getEventImageAsset } from '@/features/events/data/demo-images';
import { CategoryChip } from '@/components/discovery/CategoryChip';
import { EventCard } from '@/components/discovery/EventCard';
import { EventListItem } from '@/components/discovery/EventListItem';
import { EventMetaRow } from '@/components/discovery/EventMetaRow';
import { EventStatusBadge, TicketStatusBadge } from '@/components/discovery/EventStatusBadge';
import { FilterChip } from '@/components/discovery/FilterChip';
import { LineupItem } from '@/components/discovery/LineupItem';
import { OrganizerRow } from '@/components/discovery/OrganizerRow';
import { SearchResultItem } from '@/components/discovery/SearchResultItem';
import { VenueRow } from '@/components/discovery/VenueRow';
import {
  cancelledEvent,
  clubNightEvent,
  compactListEvents,
  hardTechnoEvent,
  longTitleEvent,
  postponedEvent,
  previewLineupItem,
  previewOrganizer,
  previewSearchResult,
  previewVenue,
  soldOutFestivalEvent,
} from '@/components/discovery/preview-fixtures';

import { PreviewThemeFrame } from './PreviewThemeFrame';

const previewHardTechnoEvent = {
  ...hardTechnoEvent,
  image: getEventImageAsset(hardTechnoEvent.id),
};

const previewClubNightEvent = {
  ...clubNightEvent,
  image: getEventImageAsset(clubNightEvent.id),
};

const previewSoldOutFestivalEvent = {
  ...soldOutFestivalEvent,
  image: getEventImageAsset(soldOutFestivalEvent.id),
};

const previewCancelledEvent = {
  ...cancelledEvent,
  image: getEventImageAsset(cancelledEvent.id),
};

function EventCardShowcase() {
  const [saved, setSaved] = useState(false);

  return (
    <Stack gap="md">
      <EventCard
        event={previewHardTechnoEvent}
        saved={saved}
        onPress={() => undefined}
        onFavoritePress={() => setSaved((current) => !current)}
      />
      <EventCard
        event={previewClubNightEvent}
        variant="featured"
        saved
        onPress={() => undefined}
        onFavoritePress={() => undefined}
      />
      <EventCard
        event={previewHardTechnoEvent}
        variant="compact"
        onPress={() => undefined}
      />
      <EventCard
        event={previewSoldOutFestivalEvent}
        onPress={() => undefined}
        onFavoritePress={() => undefined}
      />
      <EventCard
        event={previewCancelledEvent}
        onPress={() => undefined}
      />
      <EventCard
        event={postponedEvent}
        onPress={() => undefined}
      />
      <EventCard
        event={longTitleEvent}
        onPress={() => undefined}
      />
      <Stack direction="horizontal" gap="md" align="center">
        <Skeleton shape="thumbnail" />
        <Stack gap="sm" style={styles.skeletonCopy}>
          <Skeleton shape="text" />
          <Skeleton shape="text" width="70%" />
          <Skeleton shape="text" width="50%" />
        </Stack>
      </Stack>
    </Stack>
  );
}

function DiscoveryDetailsShowcase() {
  return (
    <Stack gap="md">
      <EventListItem
        event={{ ...compactListEvents[0]!, image: previewHardTechnoEvent.image }}
        saved
        onPress={() => undefined}
        onFavoritePress={() => undefined}
      />
      <EventListItem event={compactListEvents[1]!} onPress={() => undefined} />
      <SearchResultItem result={previewSearchResult} onPress={() => undefined} />
      <EventMetaRow icon="calendar-outline" label="Datum" value="Samstag, 24. Mai 2025" />
      <EventMetaRow icon="time-outline" label="Zeit" value="23:00 – 08:00" />
      <EventMetaRow
        icon="location-outline"
        label="Location"
        value="Sisyphos"
        secondaryValue="Hauptstraße 15, Berlin"
        onPress={() => undefined}
      />
      <VenueRow venue={previewVenue} onPress={() => undefined} />
      <OrganizerRow organizer={previewOrganizer} onPress={() => undefined} />
      <LineupItem artist={previewLineupItem} />
    </Stack>
  );
}

function ChipAndStatusShowcase() {
  const [selected, setSelected] = useState(true);
  const [removable, setRemovable] = useState(true);

  return (
    <Stack gap="md">
      <Stack direction="horizontal" gap="sm" style={styles.wrap}>
        <CategoryChip label="Techno" selected={selected} onPress={() => setSelected((value) => !value)} />
        <CategoryChip label="House" icon="home-outline" onPress={() => undefined} />
        <CategoryChip label="Festival" count={12} disabled onPress={() => undefined} />
        {removable ? (
          <FilterChip
            label="Berlin"
            selected
            removable
            onPress={() => undefined}
            onRemove={() => setRemovable(false)}
          />
        ) : (
          <AppText role="caption">Filter removed</AppText>
        )}
      </Stack>
      <Stack direction="horizontal" gap="sm" style={styles.wrap}>
        <EventStatusBadge status="upcoming" />
        <EventStatusBadge status="today" />
        <EventStatusBadge status="sold_out" />
        <EventStatusBadge status="cancelled" />
        <EventStatusBadge status="postponed" />
        <EventStatusBadge status="verified" />
        <TicketStatusBadge status="free" />
        <TicketStatusBadge status="limited" />
      </Stack>
    </Stack>
  );
}

export function Phase2AEventDiscoveryPreview() {
  return (
    <Section
      title="Sprint 2A Phase 2A – Core Event Components"
      subtitle="Mockup-backed discovery components — isolated from product routes and data sources"
    >
      <Section title="EventCard">
        <Stack direction="horizontal" gap="md" align="stretch" style={{ flexWrap: 'wrap' }}>
          <PreviewThemeFrame mode="light" label="Light">
            <EventCardShowcase />
          </PreviewThemeFrame>
          <PreviewThemeFrame mode="dark" label="Dark">
            <EventCardShowcase />
          </PreviewThemeFrame>
        </Stack>
      </Section>

      <Section title="EventListItem, Meta & Discovery Rows">
        <Stack direction="horizontal" gap="md" align="stretch" style={{ flexWrap: 'wrap' }}>
          <PreviewThemeFrame mode="light" label="Light">
            <DiscoveryDetailsShowcase />
          </PreviewThemeFrame>
          <PreviewThemeFrame mode="dark" label="Dark">
            <DiscoveryDetailsShowcase />
          </PreviewThemeFrame>
        </Stack>
      </Section>

      <Section title="CategoryChip, FilterChip & Status">
        <Stack direction="horizontal" gap="md" align="stretch" style={{ flexWrap: 'wrap' }}>
          <PreviewThemeFrame mode="light" label="Light">
            <ChipAndStatusShowcase />
          </PreviewThemeFrame>
          <PreviewThemeFrame mode="dark" label="Dark">
            <ChipAndStatusShowcase />
          </PreviewThemeFrame>
        </Stack>
      </Section>
    </Section>
  );
}

const styles = StyleSheet.create({
  skeletonCopy: {
    flex: 1,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
