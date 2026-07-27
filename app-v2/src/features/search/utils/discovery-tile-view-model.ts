import type { EventDiscoveryTileViewModel } from '@/components/discovery/view-models';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { resolveEventPresentation } from '@/features/events/status/event-status-resolver';

export function toEventDiscoveryTileViewModel(
  event: EventDisplayModel,
): EventDiscoveryTileViewModel {
  const presentation = resolveEventPresentation(event);

  return {
    id: event.id,
    title: event.title,
    image: event.image,
    dateLabel: event.date,
    timeLabel: event.startTime,
    venueLabel: event.venue,
    cityLabel: event.city,
    status: presentation.primaryStatus,
    ticketStatus: presentation.ticketStatus,
    accessibilityLabel: `${event.title}, ${event.venue}, ${event.city}`,
  };
}
