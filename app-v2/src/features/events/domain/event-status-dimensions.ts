import type { EventStatus } from '@/features/events/types/event-status';

/**
 * Future status dimensions for Eternal Rave (ER-005.4 foundation).
 *
 * Today a single `events.status` column maps to editorial workflow only.
 * Operational and ticket states will be added as separate columns or related
 * records — not by overloading `status` with incompatible values.
 */

export type EditorialEventStatus = EventStatus;

/** Planned: visibility and moderation outcome (maps 1:1 to current `status` today). */
export const EDITORIAL_EVENT_STATUSES = [
  'draft',
  'review',
  'published',
  'rejected',
  'archived',
] as const satisfies readonly EditorialEventStatus[];

/** Planned: runtime state independent of editorial approval. */
export type OperationalEventStatus =
  | 'scheduled'
  | 'cancelled'
  | 'postponed'
  | 'completed';

/** Planned: ticketing summary on the event (native ticketing phase). */
export type TicketAvailabilityStatus =
  | 'not_configured'
  | 'external_link'
  | 'on_sale'
  | 'sold_out'
  | 'sales_ended';

export interface EventStatusDimensions {
  editorial: EditorialEventStatus;
  operational?: OperationalEventStatus;
  ticket?: TicketAvailabilityStatus;
}

export function mapCurrentStatusToDimensions(status: EventStatus): EventStatusDimensions {
  return {
    editorial: status,
    operational: status === 'published' ? 'scheduled' : undefined,
    ticket: undefined,
  };
}
