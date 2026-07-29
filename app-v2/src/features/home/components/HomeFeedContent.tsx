import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import '@/features/discovery/discovery-app-wiring';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { spacingRoles } from '@/design/spacing';
import type { CollectionType } from '@/features/collections/event-collection-config';
import { useFavoriteToggle } from '@/features/favorites';
import {
  HOME_FEATURED_PAIR_GAP,
  getHomeFeaturedCardWidth,
} from '@/features/home/components/featured-card-layout';
import { useHomeFeed } from '@/features/home/hooks/use-home-feed';
import { useScreenBottomInset } from '@/platform/screen-insets';

import { HomeFeedSectionView } from './HomeFeedSectionView';
import { HomeFeedSkeleton } from './HomeFeedSkeleton';
import { HomeVenueRailsSection, useHomeVenueRailsLayout } from './HomeVenueRailsSection';

export function HomeFeedContent() {
  const router = useRouter();
  const bottomInset = useScreenBottomInset();
  const featuredCardWidth = getHomeFeaturedCardWidth();
  const { clubCardWidth } = useHomeVenueRailsLayout();
  const featuredSnapInterval = featuredCardWidth + HOME_FEATURED_PAIR_GAP;
  const { isFavorite, toggleFavorite, isHydrated } = useFavoriteToggle('/');

  const {
    sections,
    sectionDefinitions,
    initialLoading,
    refreshing,
    isOnline,
    refresh,
    retrySection,
    allSectionsEmpty,
    hasVisibleContent,
  } = useHomeFeed();

  const openCollection = useCallback(
    (type: CollectionType) => {
      router.push(`/collection/${type}`);
    },
    [router],
  );

  if (initialLoading) {
    return <HomeFeedSkeleton />;
  }

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
      testID="home-feed-scroll"
    >
      {!isOnline ? (
        <EmptyState
          title="Offline"
          description="Keine Internetverbindung. Ziehe nach unten, um es erneut zu versuchen."
          style={styles.offlineBanner}
        />
      ) : null}

      {allSectionsEmpty ? (
        <EmptyState
          title="Keine Events gefunden"
          description="Für deinen Standort sind derzeit keine Events verfügbar."
          primaryAction={<PrimaryButton label="Aktualisieren" onPress={() => void refresh()} />}
        />
      ) : null}

      {hasVisibleContent
        ? sectionDefinitions.map((definition, index) => {
            const state = sections[index];
            if (!state) {
              return null;
            }
            return (
              <HomeFeedSectionView
                key={definition.id}
                definition={definition}
                state={state}
                index={index}
                featuredCardWidth={featuredCardWidth}
                featuredSnapInterval={featuredSnapInterval}
                isFavorite={isFavorite}
                isHydrated={isHydrated}
                onToggleFavorite={toggleFavorite}
                onRetry={retrySection}
                onOpenCollection={openCollection}
              />
            );
          })
        : null}

      {hasVisibleContent ? <HomeVenueRailsSection clubCardWidth={clubCardWidth} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  offlineBanner: {
    paddingVertical: spacingRoles.sectionGap,
  },
});
