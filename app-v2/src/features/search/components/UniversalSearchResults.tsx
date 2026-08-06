import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SearchResultGroup } from '@/components/search/SearchResultGroup';
import type {
  OrganizerListItemViewModel,
  VenueListItemViewModel,
} from '@/components/discovery/view-models';
import { resolveSearchResultGroupTitle } from '@/components/search/search-styles';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { UniversalSearchGroupedResults } from '@/features/search/domain/universal-search-types';
import type { SearchEntityTab } from '@/features/search/domain/location-scope';
import { toUniversalSearchEventViewModel } from '@/features/search/utils/universal-search-event-view-model';

import { SearchEntityTabRow } from './SearchEntityTabRow';

export interface UniversalSearchResultsProps {
  grouped: UniversalSearchGroupedResults;
  entityTab: SearchEntityTab;
  onEntityTabChange: (tab: SearchEntityTab) => void;
  events: EventDisplayModel[];
  isFavorite: (eventId: string) => boolean;
  onToggleFavorite: (eventId: string) => void;
}

function toVenueViewModel(result: UniversalSearchGroupedResults['venues'][number]): VenueListItemViewModel {
  return {
    id: result.id,
    name: result.title,
    cityLabel: result.subtitle ?? '',
    accessibilityLabel: result.title,
  };
}

function toOrganizerViewModel(
  result: UniversalSearchGroupedResults['organizers'][number],
): OrganizerListItemViewModel {
  return {
    id: result.id,
    name: result.title,
    subtitleLabel: result.subtitle,
    accessibilityLabel: result.title,
  };
}

function navigateIfRoute(router: ReturnType<typeof useRouter>, route: string | undefined): void {
  if (!route?.trim()) {
    return;
  }
  router.push(route as Href);
}

export function UniversalSearchResults({
  grouped,
  entityTab,
  onEntityTabChange,
  events,
  isFavorite,
  onToggleFavorite: _onToggleFavorite,
}: UniversalSearchResultsProps) {
  const router = useRouter();
  const showArtists = entityTab === 'all' || entityTab === 'artists';
  const showVenues = entityTab === 'all' || entityTab === 'venues';
  const showOrganizers = entityTab === 'all' || entityTab === 'organizers';
  const showEvents = entityTab === 'all' || entityTab === 'events';

  return (
    <View style={styles.container}>
      <SearchEntityTabRow value={entityTab} onChange={onEntityTabChange} />

      {showArtists && grouped.artists.length > 0 ? (
        <SearchResultGroup
          group={{
            kind: 'clubs',
            title: 'Artists',
            count: grouped.artists.length,
          }}
          clubs={grouped.artists.map((artist) => ({
            id: artist.id,
            name: artist.title,
            cityLabel: artist.subtitle ?? '',
            accessibilityLabel: artist.title,
          }))}
          onClubPress={(id) => {
            const artist = grouped.artists.find((entry) => entry.id === id);
            navigateIfRoute(router, artist?.route);
          }}
          isClubPressable={(id) =>
            Boolean(grouped.artists.find((entry) => entry.id === id)?.route?.trim())
          }
        />
      ) : null}

      {showVenues && grouped.venues.length > 0 ? (
        <SearchResultGroup
          group={{
            kind: 'venues',
            title: resolveSearchResultGroupTitle('clubs'),
            count: grouped.venues.length,
          }}
          venues={grouped.venues.map(toVenueViewModel)}
          onVenuePress={(id) => {
            const venue = grouped.venues.find((entry) => entry.id === id);
            navigateIfRoute(router, venue?.route);
          }}
          isVenuePressable={(id) =>
            Boolean(grouped.venues.find((entry) => entry.id === id)?.route?.trim())
          }
        />
      ) : null}

      {showOrganizers && grouped.organizers.length > 0 ? (
        <SearchResultGroup
          group={{
            kind: 'organizers',
            title: resolveSearchResultGroupTitle('organizers'),
            count: grouped.organizers.length,
          }}
          organizers={grouped.organizers.map(toOrganizerViewModel)}
          onOrganizerPress={(id) => {
            const organizer = grouped.organizers.find((entry) => entry.id === id);
            navigateIfRoute(router, organizer?.route);
          }}
          isOrganizerPressable={(id) =>
            Boolean(grouped.organizers.find((entry) => entry.id === id)?.route?.trim())
          }
        />
      ) : null}

      {showEvents && events.length > 0 ? (
        <SearchResultGroup
          group={{
            kind: 'events',
            title: resolveSearchResultGroupTitle('events'),
            count: grouped.totalEventMatches,
          }}
          events={events.map((event) => toUniversalSearchEventViewModel(event, isFavorite(event.id)))}
          onEventPress={(id) => router.push(`/event/${encodeURIComponent(id)}` as Href)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
});
