import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SearchSectionHeader } from '@/components/search/SearchItems';
import { VenueSpotlightCard } from '@/components/discovery/VenueSpotlightCard';
import { spacing, spacingRoles } from '@/design/spacing';
import {
  eventRepository,
  EventDiscoveryCard,
  isFeaturedEventId,
  toEventDisplayModel,
  type EventDisplayModel,
} from '@/features/events';
import { getHomeFeaturedCardWidth, HOME_FEATURED_PAIR_GAP } from '@/features/home/components/featured-card-layout';
import { getDefaultCityValue } from '@/features/search/config/filter-config';
import type { GenreFilterId } from '@/features/search/config/filter-config.types';
import type { DateRangeFilter } from '@/features/search/constants';
import { applyEventFilters } from '@/features/search/utils/filter-events';
import { HOME_CLUB_FIXTURES, getHomeClubSpotlightWidth } from '@/features/home/data/home-club-fixtures';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface ExploreSectionConfig {
  id: string;
  titleKey: 'trending' | 'tonight' | 'weekend' | 'newlyAdded' | 'nearby' | 'genres';
  dateRange: DateRangeFilter;
  genres?: GenreFilterId[];
  limit?: number;
  layout: 'featuredRail' | 'compactList';
}

const DEFAULT_SECTIONS: ExploreSectionConfig[] = [
  { id: 'trending', titleKey: 'trending', dateRange: 'all-dates', limit: 6, layout: 'featuredRail' },
  { id: 'tonight', titleKey: 'tonight', dateRange: 'today', limit: 4, layout: 'compactList' },
  { id: 'weekend', titleKey: 'weekend', dateRange: 'this-weekend', limit: 4, layout: 'compactList' },
  { id: 'new', titleKey: 'newlyAdded', dateRange: 'all-dates', limit: 4, layout: 'compactList' },
  { id: 'nearby', titleKey: 'nearby', dateRange: 'all-dates', limit: 4, layout: 'compactList' },
  { id: 'genres', titleKey: 'genres', dateRange: 'all-dates', genres: ['techno'], limit: 4, layout: 'compactList' },
];

export interface ExploreFeedProps {
  isFavorite?: (eventId: string) => boolean;
  onToggleFavorite?: (eventId: string) => void;
}

function getSectionEvents(section: ExploreSectionConfig): EventDisplayModel[] {
  const events = applyEventFilters(eventRepository.getPublishedEvents(), {
    query: '',
    dateRange: section.dateRange,
    genres: section.genres ?? [],
    city: getDefaultCityValue(),
    sortBy: 'recommended',
  });
  const limited = section.limit ? events.slice(0, section.limit) : events;
  return limited.map(toEventDisplayModel);
}

function resolveCardVariant(event: EventDisplayModel, layout: ExploreSectionConfig['layout']) {
  if (layout === 'featuredRail') {
    return isFeaturedEventId(event.id) ? 'featuredHome' : 'verticalPremium';
  }

  return 'compactPremium';
}

export function ExploreFeed({ isFavorite, onToggleFavorite }: ExploreFeedProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const clubCardWidth = getHomeClubSpotlightWidth();
  const featuredCardWidth = getHomeFeaturedCardWidth();
  const featuredSnapInterval = featuredCardWidth + HOME_FEATURED_PAIR_GAP;

  const sections = useMemo(() => {
    return DEFAULT_SECTIONS.map((section) => ({
      ...section,
      title: t(`search.explore.${section.titleKey}`),
      events: getSectionEvents(section),
    })).filter((section) => section.events.length > 0);
  }, [t]);

  if (sections.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <SearchSectionHeader title={section.title} style={styles.sectionHeader} />
          {section.layout === 'featuredRail' ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={featuredSnapInterval}
              snapToAlignment="start"
              disableIntervalMomentum
              contentContainerStyle={styles.featuredRow}
            >
              {section.events.map((event) => (
                <EventDiscoveryCard
                  key={event.id}
                  event={event}
                  variant={resolveCardVariant(event, section.layout)}
                  width={featuredCardWidth}
                  saved={isFavorite?.(event.id)}
                  onFavoritePress={
                    onToggleFavorite ? () => onToggleFavorite(event.id) : undefined
                  }
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.compactList}>
              {section.events.map((event) => (
                <EventDiscoveryCard
                  key={event.id}
                  event={event}
                  variant="compactPremium"
                  saved={isFavorite?.(event.id)}
                  onFavoritePress={
                    onToggleFavorite ? () => onToggleFavorite(event.id) : undefined
                  }
                />
              ))}
            </View>
          )}
        </View>
      ))}
      <View style={styles.section}>
        <SearchSectionHeader title={t('search.explore.topClubs')} style={styles.sectionHeader} />
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.clubRail}
        >
          {HOME_CLUB_FIXTURES.map((club) => (
            <VenueSpotlightCard
              key={club.id}
              venue={club}
              width={clubCardWidth}
              onPress={() => router.push('/(tabs)/search')}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  featuredRow: {
    gap: HOME_FEATURED_PAIR_GAP,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  compactList: {
    gap: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  clubRail: {
    gap: spacing.md,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
});
