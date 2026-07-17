import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/buttons/IconButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import {
  eventRepository,
  toEventDisplayModel,
  type EventDisplayModel,
  type HomeFilterChipId,
} from '@/features/events';
import { useFavorites } from '@/features/favorites';
import {
  EventCard,
  FeaturedEventCard,
  FilterChipRow,
  HomeHeader,
  LocationSelector,
  SearchBar,
  SectionHeader,
  getFeaturedCardWidth,
} from '@/features/home/components';
import { useSearchFilters } from '@/features/search/SearchContext';

function matchesFilter(event: EventDisplayModel, filterId: HomeFilterChipId): boolean {
  if (filterId === 'all') return true;
  if (filterId === 'techno') {
    return event.genres.some((genre) => genre.toLowerCase().includes('techno'));
  }
  if (filterId === 'house') {
    return event.genres.some((genre) => genre.toLowerCase().includes('house'));
  }
  return true;
}

export default function HomeScreen() {
  const router = useRouter();
  const { requestSearchFocus } = useSearchFilters();
  const insets = useSafeAreaInsets();
  const tabBarHeight =
    layout.bottomNavHeight +
    (Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm);
  const featuredCardWidth = getFeaturedCardWidth();
  const featuredSnapInterval = featuredCardWidth + spacing.md;
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const [selectedFilter, setSelectedFilter] = useState<HomeFilterChipId>('all');

  const featuredEvents = useMemo(() => {
    return eventRepository
      .getFeaturedEvents()
      .map(toEventDisplayModel)
      .filter((event) => matchesFilter(event, selectedFilter));
  }, [selectedFilter]);

  const tonightEvents = useMemo(() => {
    return eventRepository
      .getSecondaryHomeEvents()
      .map(toEventDisplayModel)
      .filter((event) => matchesFilter(event, selectedFilter));
  }, [selectedFilter]);

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']}>
        <HomeHeader />
        <View style={styles.controlsRow}>
          <LocationSelector />
          <IconButton
            icon="options-outline"
            accessibilityLabel="Filters"
            onPress={() => undefined}
          />
        </View>
        <SearchBar
          onPress={() => {
            requestSearchFocus();
            router.navigate('/(tabs)/search');
          }}
        />
        <FilterChipRow selectedId={selectedFilter} onSelect={setSelectedFilter} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarHeight + spacingRoles.listBottomInset },
          ]}
        >
          <SectionHeader title="Events in deiner Nähe" actionLabel="Mehr anzeigen" isFirst />
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
            {featuredEvents.map((event) => (
              <FeaturedEventCard
                key={event.id}
                event={event}
                width={featuredCardWidth}
                isFavorite={isHydrated && isFavorite(event.id)}
                onToggleFavorite={() => toggleFavorite(event.id)}
              />
            ))}
          </ScrollView>

          <SectionHeader title="Heute Abend" actionLabel="Mehr anzeigen" />
          <View style={styles.listSection}>
            {tonightEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isFavorite={isHydrated && isFavorite(event.id)}
                onToggleFavorite={() => toggleFavorite(event.id)}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  scrollContent: {
    flexGrow: 0,
  },
  featuredRow: {
    paddingLeft: spacingRoles.screenHorizontal,
    paddingRight: layout.featuredCardPeek,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  listSection: {
    gap: 0,
  },
});
