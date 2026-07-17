import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/buttons/IconButton';
import { AppScreen } from '@/components/layout/AppScreen';
import { SafeAreaContainer } from '@/components/layout/SafeAreaContainer';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import { eventRepository, toEventDisplayModel } from '@/features/events';
import { useFavorites } from '@/features/favorites';
import {
  EventCard,
  FeaturedEventCard,
  HomeHeader,
  LocationSelector,
  SectionHeader,
  getFeaturedCardWidth,
} from '@/features/home/components';
import {
  getMoreUpcomingEvents,
  getTonightEvents,
  getWeekendEvents,
} from '@/features/home/utils/home-sections';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight =
    layout.bottomNavHeight +
    (Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm);
  const featuredCardWidth = getFeaturedCardWidth();
  const featuredSnapInterval = featuredCardWidth + spacing.md;
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();

  const publishedEvents = useMemo(() => eventRepository.getPublishedEvents(), []);

  const featuredEvents = useMemo(
    () => eventRepository.getFeaturedEvents().map(toEventDisplayModel),
    [],
  );

  const tonightEvents = useMemo(
    () => getTonightEvents(publishedEvents).map(toEventDisplayModel),
    [publishedEvents],
  );

  const weekendEvents = useMemo(
    () => getWeekendEvents(publishedEvents).map(toEventDisplayModel),
    [publishedEvents],
  );

  const moreEvents = useMemo(
    () => getMoreUpcomingEvents(publishedEvents).map(toEventDisplayModel),
    [publishedEvents],
  );

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

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarHeight + spacingRoles.listBottomInset },
          ]}
        >
          <SectionHeader title="Highlights" actionLabel="Mehr anzeigen" isFirst />
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

          {tonightEvents.length > 0 ? (
            <>
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
            </>
          ) : null}

          {weekendEvents.length > 0 ? (
            <>
              <SectionHeader title="Dieses Wochenende" actionLabel="Mehr anzeigen" />
              <View style={styles.listSection}>
                {weekendEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isFavorite={isHydrated && isFavorite(event.id)}
                    onToggleFavorite={() => toggleFavorite(event.id)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {moreEvents.length > 0 ? (
            <>
              <SectionHeader title="Kommende Events" actionLabel="Mehr anzeigen" />
              <View style={styles.listSection}>
                {moreEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isFavorite={isHydrated && isFavorite(event.id)}
                    onToggleFavorite={() => toggleFavorite(event.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
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
