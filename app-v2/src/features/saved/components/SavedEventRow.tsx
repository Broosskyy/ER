import { memo } from 'react';

import { DemoEvent } from '@/features/events/data/demo-events';
import { EventCard } from '@/features/home/components';

export interface SavedEventRowProps {
  event: DemoEvent;
  isFavorite: boolean;
  onToggleFavorite: (eventId: string) => void;
}

export const SavedEventRow = memo(function SavedEventRow({
  event,
  isFavorite,
  onToggleFavorite,
}: SavedEventRowProps) {
  return (
    <EventCard
      event={event}
      isFavorite={isFavorite}
      onToggleFavorite={() => onToggleFavorite(event.id)}
    />
  );
});
