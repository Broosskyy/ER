import { ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextButton } from '@/components/buttons/TextButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SearchSectionHeader } from '@/components/search/SearchItems';
import { spacing, spacingRoles } from '@/design/spacing';
import { EventDiscoveryCard } from '@/features/events';
import {
  HOME_FEATURED_PAIR_GAP,
  getHomeFeaturedCardWidth,
} from '@/features/home/components/featured-card-layout';
import { homeGoldenSpacing } from '@/features/home/home-golden-spacing';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

import { HOME_FEED_RAIL_SECTIONS } from '../feed/home-feed-section-config';
import type { HomeFeedSectionDefinition, HomeFeedSectionState } from '../feed/home-feed-types';

export interface HomeFeedSectionViewProps {
  definition: HomeFeedSectionDefinition;
  state: HomeFeedSectionState;
  index: number;
  featuredCardWidth: number;
  featuredSnapInterval: number;
  isFavorite: (eventId: string) => boolean;
  isHydrated: boolean;
  onToggleFavorite: (eventId: string) => void;
  onRetry: (sectionId: string) => void;
  onOpenCollection?: (collectionType: NonNullable<HomeFeedSectionDefinition['collectionType']>) => void;
}

export function HomeFeedSectionView({
  definition,
  state,
  index,
  featuredCardWidth,
  featuredSnapInterval,
  isFavorite,
  isHydrated,
  onToggleFavorite,
  onRetry,
  onOpenCollection,
}: HomeFeedSectionViewProps) {
  const { t } = useAppTranslation();

  if (state.loading) {
    return null;
  }

  if (state.error) {
    return (
      <View style={styles.section}>
        <SearchSectionHeader title={definition.title} style={index === 0 ? styles.headerFirst : styles.header} />
        <EmptyState
          title={definition.emptyTitle}
          description={state.error}
          primaryAction={<PrimaryButton label="Erneut versuchen" onPress={() => onRetry(definition.id)} />}
        />
      </View>
    );
  }

  if (state.events.length === 0) {
    return null;
  }

  const isRail = HOME_FEED_RAIL_SECTIONS.has(definition.id);

  return (
    <View style={styles.section}>
      <SearchSectionHeader
        title={definition.title}
        action={
          isRail || !definition.collectionType || !onOpenCollection ? undefined : (
            <TextButton
              label={t('home.sections.all')}
              onPress={() => onOpenCollection(definition.collectionType!)}
              style={styles.sectionAction}
            />
          )
        }
        style={index === 0 ? styles.headerFirst : styles.header}
      />

      {isRail ? (
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
          {state.events.map((event) => (
            <EventDiscoveryCard
              key={event.id}
              event={event}
              variant="featuredHome"
              width={featuredCardWidth}
              saved={isHydrated && isFavorite(event.id)}
              onFavoritePress={() => onToggleFavorite(event.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.listSection}>
          {state.events.map((event) => (
            <EventDiscoveryCard
              key={event.id}
              event={event}
              variant="compactPremium"
              saved={isHydrated && isFavorite(event.id)}
              onFavoritePress={() => onToggleFavorite(event.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    marginTop: homeGoldenSpacing.sectionGap,
    marginBottom: homeGoldenSpacing.sectionTitleGap,
  },
  headerFirst: {
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
});
