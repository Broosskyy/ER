import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { eventRepository, toEventDisplayModel, type EventDisplayModel } from '@/features/events';
import { ExplorePosterGrid } from '@/features/search/components/ExplorePosterGrid';
import type { DateRangeFilter, SearchGenreChipId } from '@/features/search/constants';
import { applyEventFilters } from '@/features/search/utils/filter-events';

export interface ExploreSectionConfig {
  id: string;
  title: string;
  dateRange: DateRangeFilter;
  genreId?: SearchGenreChipId;
  limit?: number;
}

const DEFAULT_SECTIONS: ExploreSectionConfig[] = [
  { id: 'trending', title: 'Trending in Köln', dateRange: 'explore', limit: 4 },
  { id: 'tonight', title: 'Tonight', dateRange: 'today', limit: 4 },
  { id: 'weekend', title: 'This Weekend', dateRange: 'this-weekend', limit: 4 },
  { id: 'techno', title: 'Techno', dateRange: 'explore', genreId: 'techno', limit: 4 },
  { id: 'hard-techno', title: 'Hard Techno', dateRange: 'explore', genreId: 'hard-techno', limit: 4 },
];

export interface ExploreFeedProps {
  dateRange: DateRangeFilter;
  genreId: SearchGenreChipId;
}

function getSectionEvents(section: ExploreSectionConfig): EventDisplayModel[] {
  const genreId = section.genreId ?? 'all';
  const events = applyEventFilters(eventRepository.getPublishedEvents(), {
    query: '',
    dateRange: section.dateRange,
    genreId,
    city: 'Köln',
    sortBy: 'recommended',
  });
  const limited = section.limit ? events.slice(0, section.limit) : events;
  return limited.map(toEventDisplayModel);
}

export function ExploreFeed({ dateRange, genreId }: ExploreFeedProps) {
  const sections = useMemo(() => {
    if (dateRange !== 'explore' || genreId !== 'all') {
      const events = applyEventFilters(eventRepository.getPublishedEvents(), {
        query: '',
        dateRange,
        genreId,
        city: 'Köln',
        sortBy: 'recommended',
      }).map(toEventDisplayModel);

      if (events.length === 0) {
        return [];
      }

      return [{ id: 'filtered', title: 'Events', events }];
    }

    return DEFAULT_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      events: getSectionEvents(section),
    })).filter((section) => section.events.length > 0);
  }, [dateRange, genreId]);

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
