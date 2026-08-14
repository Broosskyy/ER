import type { EventFilters } from '@/features/search/constants';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export function countActiveFilters(filters: EventFilters): number {
  void filters;
  return 0;
}

export function getActiveFilterSummaries(filters: EventFilters): string[] {
  void filters;
  return [];
}

export function hasDiscoverySearchQuery(filters: EventFilters): boolean {
  return Boolean(filters.query?.trim());
}

export function hasActiveFilters(filters: EventFilters): boolean {
  return countActiveFilters(filters) > 0 || hasDiscoverySearchQuery(filters);
}

export function isExploreMode(filters: EventFilters): boolean {
  return !hasDiscoverySearchQuery(filters);
}

export function summarizeActiveFilters(filters: EventFilters): string {
  return getActiveFilterSummaries(filters).join(' · ');
}

export function filterEvents<T extends { title: string }>(events: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return events;
  return events.filter((event) => event.title.toLowerCase().includes(normalized));
}

export function applyEventFilters(events: EventDisplayModel[], filters: EventFilters): EventDisplayModel[] {
  void filters;
  return events;
}
