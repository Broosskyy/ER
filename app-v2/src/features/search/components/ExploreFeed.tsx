import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { eventRepository, toEventDisplayModel, type EventDisplayModel } from '@/features/events';
import { ExplorePosterGrid } from '@/features/search/components/ExplorePosterGrid';
import { getDefaultCityValue } from '@/features/search/config/filter-config';
import type { GenreFilterId } from '@/features/search/config/filter-config.types';
import type { DateRangeFilter } from '@/features/search/constants';
import { applyEventFilters } from '@/features/search/utils/filter-events';

export interface ExploreSectionConfig {
  id: string;
  title: string;
  dateRange: DateRangeFilter;
  genres?: GenreFilterId[];
  limit?: number;
}

const DEFAULT_SECTIONS: ExploreSectionConfig[] = [
  { id: 'trending', title: 'Trending in Köln', dateRange: 'all-dates', limit: 4 },
  { id: 'tonight', title: 'Tonight', dateRange: 'today', limit: 4 },
  { id: 'weekend', title: 'This Weekend', dateRange: 'this-weekend', limit: 4 },
  { id: 'techno', title: 'Techno', dateRange: 'all-dates', genres: ['techno'], limit: 4 },
  { id: 'hard-techno', title: 'Hard Techno', dateRange: 'all-dates', genres: ['hard-techno'], limit: 4 },
];

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

export function ExploreFeed() {
  const sections = useMemo(() => {
    return DEFAULT_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      events: getSectionEvents(section),
    })).filter((section) => section.events.length > 0);
  }, []);

  if (sections.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <AppText style={styles.sectionTitle}>{section.title}</AppText>
          <ExplorePosterGrid events={section.events} />
        </View>
      ))}
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
  sectionTitle: {
    ...textRoles.sectionTitle,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
});
