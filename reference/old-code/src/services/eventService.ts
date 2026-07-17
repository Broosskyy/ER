/** Sprint 3 — Event domain services & repository exports */
export { eventRepository, EventRepository } from '@/repositories/eventRepository';
export * from '@/services/eventDraftService';
export * from '@/services/eventSubmissionService';
export {
  transitionEventLifecycle,
  fetchReviewAuditLog,
  archiveEvent,
  softDeleteEvent,
} from '@/services/eventLifecycleService';
export * from '@/validation/eventValidation';
export { eventRowToEntity, entityToEventRowPatch } from '@/utils/eventEntityMapper';
export * from '@/domain/event';

/** Legacy Sprint 2 feed + lifecycle (unchanged public API) */
export {
  fetchPublishedEvents,
  fetchPublishedEventById,
  fetchEventById,
  fetchReviewEvents,
  updateEventLifecycle,
  createOrganizerEvent,
  updateOrganizerEvent,
  fetchOrganizerEvents,
  fetchAllEventsForDuplicateCheck,
  resolveDuplicateForInput,
  createUserSubmissionEvent,
  fetchUserSubmissionEvents,
  fetchReviewEventById,
  updateReviewEvent,
  fetchLineupForEvents,
} from './events';
