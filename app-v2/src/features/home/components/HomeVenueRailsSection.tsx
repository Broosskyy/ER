import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { VenueRow } from '@/components/discovery/VenueRow';
import { VenueSpotlightCard } from '@/components/discovery/VenueSpotlightCard';
import { SearchSectionHeader } from '@/components/search/SearchItems';
import { spacing, spacingRoles } from '@/design/spacing';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

import {
  getHomeClubSpotlightWidth,
  HOME_CLUB_FIXTURES,
} from '../data/home-club-fixtures';
import { homeGoldenSpacing } from '../home-golden-spacing';

export interface HomeVenueRailsSectionProps {
  clubCardWidth: number;
}

/** Compact club and venue rails — separate from event carousels. */
export function HomeVenueRailsSection({ clubCardWidth }: HomeVenueRailsSectionProps) {
  const { t } = useAppTranslation();
  const router = useRouter();

  const openSearch = () => router.push('/(tabs)/search');

  return (
    <View style={styles.root}>
      <View style={styles.section}>
        <SearchSectionHeader title={t('home.sections.topClubs')} style={styles.header} />
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
              onPress={openSearch}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <SearchSectionHeader title="Venues" style={styles.header} />
        <View style={styles.venueList}>
          {HOME_CLUB_FIXTURES.slice(0, 4).map((venue) => (
            <VenueRow key={`venue-${venue.id}`} venue={venue} onPress={openSearch} />
          ))}
        </View>
      </View>
    </View>
  );
}

export function useHomeVenueRailsLayout() {
  return {
    clubCardWidth: getHomeClubSpotlightWidth(),
  };
}

const styles = StyleSheet.create({
  root: {
    gap: homeGoldenSpacing.sectionGap,
    marginTop: homeGoldenSpacing.sectionGap,
  },
  section: {
    gap: homeGoldenSpacing.sectionTitleGap,
  },
  header: {
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  clubsRow: {
    paddingHorizontal: spacingRoles.screenHorizontal,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  venueList: {
    gap: spacing.sm,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
});
