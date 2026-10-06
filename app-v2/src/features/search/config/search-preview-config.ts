import {
  addDays,
  endOfDay,
  startOfDay,
} from '@/features/events/formatting/date-time';
import type { EventFilters, SortByFilter } from '@/features/search/constants';
import type { DateRangeFilter } from '@/features/search/constants';

export type SearchPreviewPresetId =
  | 'upcoming'
  | 'today'
  | 'tomorrow'
  | 'this-weekend'
  | 'next-weekend'
  | 'trending'
  | 'nearby'
  | 'recently-added';

export interface SearchPreviewSectionConfig {
  id: string;
  titleKey: SearchPreviewPresetId;
  dateRange: DateRangeFilter;
  sortBy?: SortByFilter;
  genres?: EventFilters['genres'];
  limit?: number;
  layout: 'featuredRail' | 'compactList';
  /** Optional ISO window — overrides dateRange when set. */
  dateStartAt?: string | null;
  dateEndAt?: string | null;
}

function getWeekendWindow(referenceDate: Date, offsetDays = 0): { startAt: Date; endAt: Date } {
  const shifted = addDays(referenceDate, offsetDays);
  const day = shifted.getDay();
  const daysUntilFriday = day <= 5 ? 5 - day : 0;
  const friday = startOfDay(addDays(shifted, daysUntilFriday));
  const sunday = endOfDay(addDays(friday, 2));
  return { startAt: friday, endAt: sunday };
}

/** Configurable discovery preview — not fixed to a rolling three-week window. */
export const SEARCH_PREVIEW_SECTIONS: SearchPreviewSectionConfig[] = [
  {
    id: 'trending',
    titleKey: 'trending',
    dateRange: 'all-dates',
    sortBy: 'trending',
    limit: 6,
    layout: 'featuredRail',
  },
  {
    id: 'today',
    titleKey: 'today',
    dateRange: 'today',
    limit: 4,
    layout: 'compactList',
  },
  {
    id: 'tomorrow',
    titleKey: 'tomorrow',
    dateRange: 'all-dates',
    limit: 4,
    layout: 'compactList',
  },
  {
    id: 'this-weekend',
    titleKey: 'this-weekend',
    dateRange: 'this-weekend',
    limit: 4,
    layout: 'compactList',
  },
  {
    id: 'next-weekend',
    titleKey: 'next-weekend',
    dateRange: 'all-dates',
    limit: 4,
    layout: 'compactList',
  },
  {
    id: 'upcoming',
    titleKey: 'upcoming',
    dateRange: 'upcoming',
    limit: 4,
    layout: 'compactList',
  },
  {
    id: 'nearby',
    titleKey: 'nearby',
    dateRange: 'all-dates',
    sortBy: 'distance',
    limit: 4,
    layout: 'compactList',
  },
  {
    id: 'recently-added',
    titleKey: 'recently-added',
    dateRange: 'all-dates',
    sortBy: 'newest',
    limit: 4,
    layout: 'compactList',
  },
];

export function resolveSearchPreviewDateWindow(
  section: SearchPreviewSectionConfig,
  now: Date,
): { dateStartAt: string | null; dateEndAt: string | null } {
  if (section.dateStartAt || section.dateEndAt) {
    return {
      dateStartAt: section.dateStartAt ?? null,
      dateEndAt: section.dateEndAt ?? null,
    };
  }

  if (section.titleKey === 'tomorrow') {
    const tomorrow = addDays(startOfDay(now), 1);
    return {
      dateStartAt: startOfDay(tomorrow).toISOString(),
      dateEndAt: endOfDay(tomorrow).toISOString(),
    };
  }

  if (section.titleKey === 'next-weekend') {
    const window = getWeekendWindow(now, 7);
    return {
      dateStartAt: window.startAt.toISOString(),
      dateEndAt: window.endAt.toISOString(),
    };
  }

  return { dateStartAt: null, dateEndAt: null };
}

export function buildSearchPreviewFilters(
  section: SearchPreviewSectionConfig,
  base: EventFilters,
  now: Date = new Date(),
): EventFilters {
  const window = resolveSearchPreviewDateWindow(section, now);
  return {
    ...base,
    dateRange: window.dateStartAt || window.dateEndAt ? base.dateRange : section.dateRange,
    sortBy: section.sortBy ?? base.sortBy,
    genres: section.genres ?? [],
    dateStartAt: window.dateStartAt,
    dateEndAt: window.dateEndAt,
  };
}
