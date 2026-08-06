import type { EventDiscoveryTileViewModel } from '@/components/discovery/view-models';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { resolvePublicTicketPresentation } from '@/features/events/formatting/ticket-presentation';
import { resolveEventPresentation } from '@/features/events/status/event-status-resolver';

export function toEventDiscoveryTileViewModel(
  event: EventDisplayModel,
): EventDiscoveryTileViewModel {
  const presentation = resolveEventPresentation(event);
  const ticket = resolvePublicTicketPresentation(event);

  return {
    id: event.id,
    title: event.title,
    image: event.image,
    dateLabel: event.date,
    timeLabel: event.startTime,
    venueLabel: event.venueLabel ?? event.venue,
    cityLabel: event.cityLabel ?? event.city,
    status: presentation.primaryStatus,
    ticketStatus: presentation.ticketStatus,
    ticketLabel: ticket.ticketLabel,
    ticketColorToken: ticket.colorToken,
    accessibilityLabel: `${event.title}, ${event.locationLabelDot ?? `${event.venueLabel ?? event.venue} · ${event.cityLabel ?? event.city}`}`,
  };
}
