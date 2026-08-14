import { memo } from 'react';

import { EventDiscoveryCard } from '@/features/events';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export interface SavedEventRowProps {
  event: EventDisplayModel;
  isFavorite: boolean;
  onToggleFavorite: (eventId: string) => void;
}

export const SavedEventRow = memo(function SavedEventRow({
  event,
  isFavorite,
  onToggleFavorite,
}: SavedEventRowProps) {
  return (
    <EventDiscoveryCard
      event={event}
      variant="compactPremium"
      saved={isFavorite}
      onFavoritePress={() => onToggleFavorite(event.id)}
    />
  );
});
