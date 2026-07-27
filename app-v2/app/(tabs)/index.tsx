import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { TextButton } from '@/components/buttons/TextButton';
import { VenueSpotlightCard } from '@/components/discovery/VenueSpotlightCard';
import { SearchSectionHeader } from '@/components/search/SearchItems';
import { spacing, spacingRoles } from '@/design/spacing';
import {
  getCollectionConfig,
  getCollectionPreviewEvents,
  type CollectionType,
} from '@/features/collections';
import {
  EventDiscoveryCard,
  toEventDisplayModel,
} from '@/features/events';
import { useFavoriteToggle } from '@/features/favorites';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import {
  HomeHeader,
  LocationSelector,
  HOME_FEATURED_PAIR_GAP,
  getHomeFeaturedCardWidth,
} from '@/features/home/components';
import {
  getHomeClubSpotlightWidth,
  HOME_CLUB_FIXTURES,
} from '@/features/home/data/home-club-fixtures';
import { homeGoldenSpacing } from '@/features/home/home-golden-spacing';
import { useScreenBottomInset } from '@/platform/screen-insets';
import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';
import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';

const HOME_SECTIONS: CollectionType[] = ['highlights', 'tonight', 'weekend', 'upcoming', 'techno', 'house'];

const COMPACT_PREMIUM_SECTIONS = new Set<CollectionType>([
  'tonight',
  'weekend',
  'upcoming',
  'techno',
  'house',
]);
const HOME_RAIL_SECTIONS = new Set<CollectionType>(['highlights', 'tonight']);

export default function HomeScreen() {
  useWebDocumentTitle(WEB_PAGE_TITLES.home, '/');
  const { t } = useAppTranslation();
  const router = useRouter();
  const bottomInset = useScreenBottomInset();
  const featuredCardWidth = getHomeFeaturedCardWidth();
  const clubCardWidth = getHomeClubSpotlightWidth();
  const featuredSnapInterval = featuredCardWidth + HOME_FEATURED_PAIR_GAP;
  const { isFavorite, toggleFavorite, isHydrated } = useFavoriteToggle('/');

  const openCollection = useCallback(
    (type: CollectionType) => {
      router.push(`/collection/${type}`);
    },
    [router],
  );

  const sectionData = useMemo(() => {
    return HOME_SECTIONS.map((type) => {
      const config = getCollectionConfig(type);
      const events = getCollectionPreviewEvents(type).map(toEventDisplayModel);
      return { type, config, events };
    }).filter((section) => section.events.length > 0);
  }, []);

  return (
    <AppScreen>
      <SafeAreaContainer edges={['top']} style={styles.safeArea}>
        <ResponsiveScreen>
          <HomeHeader />
          <View style={styles.locationRow}>
            <LocationSelector />
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: bottomInset },
            ]}
          >
            {sectionData.map((section, index) => (
              <View key={section.type}>
                <SearchSectionHeader
                  title={section.config.title}
                  action={
                    HOME_RAIL_SECTIONS.has(section.type) ? undefined : (
                      <TextButton
                        label={t('home.sections.all')}
                        onPress={() => openCollection(section.type)}
                        style={styles.sectionAction}
                      />
                    )
                  }
                  style={index === 0 ? styles.sectionHeaderFirst : styles.sectionHeader}
                />

                {section.type === 'highlights' ? (
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
                        variant="featuredHome"
                        width={featuredCardWidth}
                        saved={isHydrated && isFavorite(event.id)}
                        onFavoritePress={() => toggleFavorite(event.id)}
                      />
                    ))}
                  </ScrollView>
                ) : COMPACT_PREMIUM_SECTIONS.has(section.type) ? (
                  <View style={styles.listSection}>
                    {section.events.map((event) => (
                      <EventDiscoveryCard
                        key={event.id}
                        event={event}
                        variant="compactPremium"
                        saved={isHydrated && isFavorite(event.id)}
                        onFavoritePress={() => toggleFavorite(event.id)}
                      />
                    ))}
                  </View>
                ) : null}

                {section.type === 'tonight' ? (
                  <View style={styles.clubsSection}>
                    <SearchSectionHeader
                      title={t('home.sections.topClubs')}
                      style={styles.sectionHeader}
                    />
                    <ScrollView
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.clubsRow}
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
                ) : null}
              </View>
            ))}
          </ScrollView>
        </ResponsiveScreen>
      </SafeAreaContainer>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  locationRow: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginBottom: homeGoldenSpacing.locationBottom,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginTop: homeGoldenSpacing.sectionGap,
    marginBottom: homeGoldenSpacing.sectionTitleGap,
  },
  sectionHeaderFirst: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginTop: homeGoldenSpacing.firstSectionTop,
    marginBottom: homeGoldenSpacing.sectionTitleGap,
  },
  sectionAction: {
    opacity: 0.82,
    paddingHorizontal: spacing.xs,
  },
  featuredRow: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: HOME_FEATURED_PAIR_GAP,
    paddingBottom: spacing.xs,
  },
  listSection: {
    gap: homeGoldenSpacing.tonightRowGap,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  clubsSection: {
    marginTop: homeGoldenSpacing.clubsSectionTop,
    gap: homeGoldenSpacing.sectionTitleGap,
  },
  clubsRow: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
});
