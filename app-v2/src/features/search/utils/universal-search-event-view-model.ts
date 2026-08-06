import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export function toUniversalSearchEventViewModel(event: EventDisplayModel, saved: boolean) {
  return {
    id: event.id,
    title: event.title,
    venueLabel: event.venueLabel,
    cityLabel: event.cityLabel,
    dateLabel: event.date,
    timeLabel: event.startTime,
    image:
      typeof event.image === 'object' && event.image && 'uri' in event.image
        ? event.image
        : undefined,
    genreLabels: event.genres,
    saved,
    accessibilityLabel: `${event.title}, ${event.locationLabelComma}`,
  };
}
