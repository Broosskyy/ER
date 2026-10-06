import type { ImageSourcePropType } from 'react-native';

import type { EventListItemViewModel } from '@/components/discovery/view-models';

export type MapContainerState =
  | 'default'
  | 'loading'
  | 'error'
  | 'no_permission'
  | 'location_disabled'
  | 'empty'
  | 'offline';

export type MapPinStatus = 'default' | 'selected' | 'today' | 'sold_out' | 'cancelled';

export interface MapPinViewModel {
  id: string;
  label?: string;
  status: MapPinStatus;
  categoryLabel?: string;
  image?: ImageSourcePropType;
  accessibilityLabel: string;
}

export interface MapClusterViewModel {
  id: string;
  count: number;
  selected?: boolean;
  highlighted?: boolean;
  accessibilityLabel: string;
}

export interface SelectedEventMapCardViewModel extends EventListItemViewModel {
  kind: 'event';
}

export interface CitySelectorViewModel {
  id: string;
  cityLabel: string;
  regionLabel?: string;
  selected?: boolean;
  accessibilityLabel: string;
}

export interface LocationSearchResultViewModel {
  id: string;
  cityLabel: string;
  regionLabel?: string;
  countryLabel: string;
  distanceLabel?: string;
  selected?: boolean;
  recent?: boolean;
  currentLocation?: boolean;
  accessibilityLabel: string;
}

export interface MapStateViewModel {
  state: MapContainerState;
  title: string;
  description?: string;
  accessibilityLabel: string;
}
