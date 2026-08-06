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
import { useUserLocation } from '@/features/location/UserLocationProvider';
import { getDefaultCityValue } from '@/features/search/config/filter-config';
import {
  buildSearchPreviewFilters,
  SEARCH_PREVIEW_SECTIONS,
  type SearchPreviewSectionConfig,
} from '@/features/search/config/search-preview-config';
import { DEFAULT_EVENT_FILTERS } from '@/features/search/constants';
import { applyEventFilters } from '@/features/search/utils/filter-events';
import { HOME_CLUB_FIXTURES, getHomeClubSpotlightWidth } from '@/features/home/data/home-club-fixtures';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

const PREVIEW_TITLE_KEYS: Record<SearchPreviewSectionConfig['titleKey'], string> = {
  upcoming: 'search.explore.upcoming',
  today: 'search.explore.tonight',
  tomorrow: 'search.explore.tomorrow',
  'this-weekend': 'search.explore.weekend',
  'next-weekend': 'search.explore.nextWeekend',
  trending: 'search.explore.trending',
  nearby: 'search.explore.nearby',
  'recently-added': 'search.explore.newlyAdded',
};

const PREVIEW_TITLE_DEFAULTS: Record<SearchPreviewSectionConfig['titleKey'], string> = {
  upcoming: 'Demnächst',
  today: 'Heute',
  tomorrow: 'Morgen',
  'this-weekend': 'Dieses Wochenende',
  'next-weekend': 'Nächstes Wochenende',
  trending: 'Trending',
  nearby: 'In der Nähe',
  'recently-added': 'Neu hinzugefügt',
};

export interface ExploreFeedProps {
  isFavorite?: (eventId: string) => boolean;
  onToggleFavorite?: (eventId: string) => void;
}

function getSectionEvents(
  section: SearchPreviewSectionConfig,
  location?: { latitude?: number; longitude?: number },
): EventDisplayModel[] {
  const baseFilters = {
    ...DEFAULT_EVENT_FILTERS,
    city: getDefaultCityValue(),
  };
  const sectionFilters = buildSearchPreviewFilters(section, baseFilters);
  const events = applyEventFilters(eventRepository.getPublishedEvents(), sectionFilters, {
    location:
      section.titleKey === 'nearby' && location?.latitude && location?.longitude
        ? { latitude: location.latitude, longitude: location.longitude }
        : undefined,
  });
  const limited = section.limit ? events.slice(0, section.limit) : events;
  return limited.map(toEventDisplayModel);
}

function resolveCardVariant(event: EventDisplayModel, layout: SearchPreviewSectionConfig['layout']) {
  if (layout === 'featuredRail') {
    return isFeaturedEventId(event.id) ? 'featuredHome' : 'verticalPremium';
  }

  return 'compactPremium';
}

export function ExploreFeed({ isFavorite, onToggleFavorite }: ExploreFeedProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const { location } = useUserLocation();
  const clubCardWidth = getHomeClubSpotlightWidth();
  const featuredCardWidth = getHomeFeaturedCardWidth();
  const featuredSnapInterval = featuredCardWidth + HOME_FEATURED_PAIR_GAP;

  const sections = useMemo(() => {
    return SEARCH_PREVIEW_SECTIONS.map((section) => ({
      ...section,
      title: t(PREVIEW_TITLE_KEYS[section.titleKey], {
        defaultValue: PREVIEW_TITLE_DEFAULTS[section.titleKey],
      }),
      events: getSectionEvents(section, location ?? undefined),
    })).filter((section) => section.events.length > 0);
  }, [location, t]);

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
