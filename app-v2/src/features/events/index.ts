export type { Event, EventWithCoordinates } from './types/event';
export type { RawEvent } from './types/raw-event';
export type { EventStatus } from './types/event-status';
export type { EventDisplayModel } from './formatting/display-event';
export type { EventSourceAdapter } from './adapters/types';
export type { PipelineReport, PipelineEventRecord } from './pipeline/run-pipeline';
export type { ValidationResult } from './pipeline/validation-result';
export type { EventSearchFilters } from './repository/event-repository';

export { eventRepository, EventRepository } from './repository/event-repository';
export { runDefaultEventPipeline, runEventPipeline } from './pipeline/run-pipeline';
export { normalizeRawEvent } from './pipeline/normalize';
export { validateEvent } from './pipeline/validate';
export { classifyDuplicate, deduplicateEvents } from './pipeline/deduplicate';
export { toEventDisplayModel, hasMapCoordinates } from './formatting/display-event';
export {
  formatEventDateTime,
  formatEventTimeRange,
  formatDateLabel,
  formatTimeInTimezone,
  EVENT_REFERENCE_DATE,
  isUpcomingEvent,
  isThisWeekEvent,
  isThisMonthEvent,
} from './formatting/date-time';
export { getSourceDisplayLabel } from './data/demo-images';
export { HOME_FILTER_CHIPS, FEATURED_EVENT_IDS, isFeaturedEventId } from './data/home-config';
export type { HomeFilterChipId } from './data/home-config';
