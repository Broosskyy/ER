import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { eventRepository, toEventDisplayModel, type EventDisplayModel } from '@/features/events';
import { ExplorePosterGrid } from '@/features/search/components/ExplorePosterGrid';
import type { ExploreTimeFilterId, SearchGenreChipId } from '@/features/search/constants';
import { filterExploreEvents } from '@/features/search/utils/filter-events';

export interface ExploreSectionConfig {
  id: string;
  title: string;
  timeFilter: ExploreTimeFilterId;
  genreId?: SearchGenreChipId;
  limit?: number;
}

const DEFAULT_SECTIONS: ExploreSectionConfig[] = [
  { id: 'trending', title: 'Trending in Köln', timeFilter: 'explore', limit: 4 },
  { id: 'tonight', title: 'Tonight', timeFilter: 'today', limit: 4 },
  { id: 'weekend', title: 'This Weekend', timeFilter: 'this-weekend', limit: 4 },
  { id: 'techno', title: 'Techno', timeFilter: 'explore', genreId: 'techno', limit: 4 },
  { id: 'hard-techno', title: 'Hard Techno', timeFilter: 'explore', genreId: 'hard-techno', limit: 4 },
];

export interface ExploreFeedProps {
  timeFilter: ExploreTimeFilterId;
  genreId: SearchGenreChipId;
}

function getSectionEvents(section: ExploreSectionConfig): EventDisplayModel[] {
  const genreId = section.genreId ?? 'all';
  const events = filterExploreEvents(eventRepository.getPublishedEvents(), genreId, section.timeFilter);
  const limited = section.limit ? events.slice(0, section.limit) : events;
  return limited.map(toEventDisplayModel);
}

export function ExploreFeed({ timeFilter, genreId }: ExploreFeedProps) {
  const sections = useMemo(() => {
    if (timeFilter !== 'explore' || genreId !== 'all') {
      const events = filterExploreEvents(
        eventRepository.getPublishedEvents(),
        genreId,
        timeFilter,
      ).map(toEventDisplayModel);

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
  }, [timeFilter, genreId]);

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
