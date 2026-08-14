import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { EventStatus, EventTicketStatus } from '@/components/discovery/view-models';

import { resolveConsumerEventStatus, resolveConsumerTicketStatus } from '@/features/events/status/event-status-resolver';

export function formatSavedAtLabel(savedAt: string): string {
  return new Date(savedAt).toLocaleDateString('de-DE');
}

export function resolveSavedConsumerStatus(event: EventDisplayModel): EventStatus {
  return resolveConsumerEventStatus(event);
}

export function resolveSavedTicketStatus(event: EventDisplayModel): EventTicketStatus | undefined {
  return resolveConsumerTicketStatus(event);
}
