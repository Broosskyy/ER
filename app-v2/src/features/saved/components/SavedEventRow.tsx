import { memo } from 'react';

import { EventDiscoveryListItem } from '@/features/events';
import type { EventDisplayModel } from '@/features/events';

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
    <EventDiscoveryListItem
      event={event}
      saved={isFavorite}
      onFavoritePress={() => onToggleFavorite(event.id)}
    />
  );
});
