import type { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { EventListItem } from '@/components/discovery/EventListItem';
import { OrganizerRow } from '@/components/discovery/OrganizerRow';
import { VenueRow } from '@/components/discovery/VenueRow';
import type {
  EventListItemViewModel,
  OrganizerListItemViewModel,
  VenueListItemViewModel,
} from '@/components/discovery/view-models';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';

import { SearchSectionHeader } from './SearchItems';
import type { SearchResultGroupViewModel } from './view-models';

export interface SearchResultGroupProps {
  group: SearchResultGroupViewModel;
  events?: EventListItemViewModel[];
  organizers?: OrganizerListItemViewModel[];
  venues?: VenueListItemViewModel[];
  clubs?: VenueListItemViewModel[];
  onActionPress?: () => void;
  onEventPress?: (id: string) => void;
  onOrganizerPress?: (id: string) => void;
  onVenuePress?: (id: string) => void;
  onClubPress?: (id: string) => void;
  children?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Grouped search results — mockup 13 event list sections.
 * Event rows reuse `EventListItem`; entity rows reuse discovery rows.
 */
export function SearchResultGroup({
  group,
  events = [],
  organizers = [],
  venues = [],
  clubs = [],
  onActionPress,
  onEventPress,
  onOrganizerPress,
  onVenuePress,
  onClubPress,
  children,
  style,
  testID,
}: SearchResultGroupProps) {
  return (
    <View style={[styles.group, style]} testID={testID}>
      <SearchSectionHeader
        title={group.title}
        count={group.count}
        actionLabel={group.actionLabel}
        onActionPress={onActionPress}
      />
      <Stack gap="sm">
        {children}
        {group.kind === 'events'
          ? events.map((event) => (
              <EventListItem
                key={event.id}
                event={event}
                onPress={() => onEventPress?.(event.id)}
              />
            ))
          : null}
        {group.kind === 'organizers'
          ? organizers.map((organizer) => (
              <OrganizerRow
                key={organizer.id}
                organizer={organizer}
                onPress={() => onOrganizerPress?.(organizer.id)}
              />
            ))
          : null}
        {group.kind === 'venues'
          ? venues.map((venue) => (
              <VenueRow key={venue.id} venue={venue} onPress={() => onVenuePress?.(venue.id)} />
            ))
          : null}
        {group.kind === 'clubs'
          ? clubs.map((club) => (
              <VenueRow key={club.id} venue={club} onPress={() => onClubPress?.(club.id)} />
            ))
          : null}
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.md,
  },
});
