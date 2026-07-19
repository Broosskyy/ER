import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppScreen, ResponsiveScreen, SafeAreaContainer } from '@/components';
import { layout } from '@/design/layout';
import { spacing, spacingRoles } from '@/design/spacing';
import {
  getCollectionConfig,
  getCollectionPreviewEvents,
  type CollectionType,
} from '@/features/collections';
import { toEventDisplayModel } from '@/features/events';
import { useFavorites } from '@/features/favorites';
import {
  EventCard,
  FeaturedEventCard,
  HomeHeader,
  LocationSelector,
  SectionHeader,
  getFeaturedCardWidth,
} from '@/features/home/components';
import { useScreenBottomInset } from '@/platform/screen-insets';
import { WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';
import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';

const HOME_SECTIONS: CollectionType[] = ['highlights', 'tonight', 'weekend', 'upcoming', 'techno', 'house'];

export default function HomeScreen() {
  useWebDocumentTitle(WEB_PAGE_TITLES.home);
  const router = useRouter();
  const bottomInset = useScreenBottomInset();
  const featuredCardWidth = getFeaturedCardWidth();
  const featuredSnapInterval = featuredCardWidth + spacing.md;
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();

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
          <View style={styles.controlsRow}>
            <LocationSelector />
            <IconButton
              icon="options-outline"
              accessibilityLabel="Filters"
              onPress={() => router.navigate('/(tabs)/search')}
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: bottomInset },
            ]}
          >
          {sectionData.map((section, index) => (
            <View key={section.type}>
              <SectionHeader
                title={section.config.title}
                actionLabel="See all"
                isFirst={index === 0}
                onActionPress={() => openCollection(section.type)}
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
                    <FeaturedEventCard
                      key={event.id}
                      event={event}
                      width={featuredCardWidth}
                      isFavorite={isHydrated && isFavorite(event.id)}
                      onToggleFavorite={() => toggleFavorite(event.id)}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.listSection}>
                  {section.events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isFavorite={isHydrated && isFavorite(event.id)}
                      onToggleFavorite={() => toggleFavorite(event.id)}
                    />
                  ))}
                </View>
              )}
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
