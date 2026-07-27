import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { EventListItem } from '@/components/discovery/EventListItem';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { toEventListItemViewModel } from '@/features/events/formatting/event-card-view-model';

export interface EventDiscoveryListItemProps {
  event: EventDisplayModel;
  saved?: boolean;
  density?: 'default' | 'relaxed';
  onFavoritePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Feature-layer adapter for compact discovery list rows with navigation. */
export function EventDiscoveryListItem({
  event,
  saved = false,
  density = 'default',
  onFavoritePress,
  style,
  testID,
}: EventDiscoveryListItemProps) {
  const router = useRouter();
  const viewModel = useMemo(() => toEventListItemViewModel(event), [event]);

  return (
    <EventListItem
      event={viewModel}
      saved={saved}
      density={density}
      style={style}
      testID={testID}
      onPress={() => router.push(`/event/${event.id}`)}
      onFavoritePress={onFavoritePress}
    />
  );
}
