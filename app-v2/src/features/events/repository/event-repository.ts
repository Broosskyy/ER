/**
 * Backward-compatible re-export.
 * @deprecated Import from `@/data/repositories/registry` instead.
 */
export { EventRepository, type EventSearchFilters } from '@/data/repositories/repositories';
export { eventRepository, initializeRepositories } from '@/data/repositories/registry';
