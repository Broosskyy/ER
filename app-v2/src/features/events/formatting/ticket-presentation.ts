import type { SemanticColorToken } from '@/design/ticket-semantics';

import type { EventDisplayModel } from './display-event';
import { resolveEventPriceAvailabilitySemantics } from '../domain/event-price-availability-semantics';

export interface PublicTicketPresentation {
  ticketLabel?: string;
  colorToken: SemanticColorToken;
}

function resolveSemantics(event: EventDisplayModel) {
  return resolveEventPriceAvailabilitySemantics({
    priceText: event.displayPriceText ?? event.priceText,
    lifecycleStatus: event.lifecycleStatus,
    ticketAvailability: event.ticketAvailability,
    ticketPhases: event.ticketPhases?.map((phase) => ({
      soldOut: phase.soldOut,
      available: phase.available,
      label: phase.name,
    })),
  });
}

/** Unified public ticket label for cards, hero, map preview, and list rows. */
export function resolvePublicTicketPresentation(event: EventDisplayModel): PublicTicketPresentation {
  const semantics = resolveSemantics(event);

  if (semantics.showPrice && semantics.displayPriceText) {
    return { ticketLabel: semantics.displayPriceText, colorToken: semantics.colorToken };
  }

  if (semantics.showAvailabilityBadge && semantics.explanatoryLabel) {
    return { ticketLabel: semantics.explanatoryLabel, colorToken: semantics.colorToken };
  }

  if (semantics.explanatoryLabel && semantics.priceState === 'unknown') {
    return { ticketLabel: semantics.explanatoryLabel, colorToken: semantics.colorToken };
  }

  if (semantics.displayPriceText) {
    return { ticketLabel: semantics.displayPriceText, colorToken: semantics.colorToken };
  }

  return { colorToken: semantics.colorToken };
}
