import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import type { EventCardVariant } from '@/components/discovery/event-card-styles';
import { EventCard } from '@/components/discovery/EventCard';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { toEventCardViewModel } from '@/features/events/formatting/event-card-view-model';

export interface EventDiscoveryCardProps {
  event: EventDisplayModel;
  variant?: EventCardVariant;
  saved?: boolean;
  width?: number;
  onFavoritePress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Feature-layer adapter: maps EventDisplayModel to library EventCard and handles navigation.
 */
export function EventDiscoveryCard({
  event,
  variant = 'standard',
  saved = false,
  width,
  onFavoritePress,
  style,
  testID,
}: EventDiscoveryCardProps) {
  const router = useRouter();
  const viewModel = useMemo(() => toEventCardViewModel(event), [event]);

  return (
    <EventCard
      event={viewModel}
      variant={variant}
      saved={saved}
      style={[width ? { width } : undefined, style]}
      testID={testID}
      onPress={() => router.push(`/event/${event.id}`)}
      onFavoritePress={onFavoritePress}
    />
  );
}
