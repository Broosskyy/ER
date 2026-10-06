import type { ImageSourcePropType } from 'react-native';

import type { EventDisplayModel } from '@/features/events';

export type MarkerType = 'event' | 'club' | 'festival';

export type MarkerStatus = 'featured' | 'today' | 'tomorrow' | 'weekend' | 'default';

export type MapRadiusKm = 5 | 10 | 25 | 50 | 100 | 'unlimited';

export type MapLayerType = 'standard' | 'satellite' | 'dark';

export type MapSortOption = 'distance' | 'popular' | 'new' | 'date';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapViewport {
  centerLatitude: number;
  centerLongitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
  bounds: MapBounds;
}

export interface MapFilter {
  radiusKm: MapRadiusKm;
  indoor: boolean;
  outdoor: boolean;
  freeOnly: boolean;
  sortBy: MapSortOption;
}

export const DEFAULT_MAP_FILTER: MapFilter = {
  radiusKm: 25,
  indoor: true,
  outdoor: true,
  freeOnly: false,
  sortBy: 'distance',
};

export interface MapEvent {
  id: string;
  markerType: Extract<MarkerType, 'event' | 'festival'>;
  markerStatus: MarkerStatus;
  title: string;
  latitude: number;
  longitude: number;
  image: ImageSourcePropType;
  dateLabel: string;
  timeLabel: string;
  venueLabel: string;
  cityLabel: string;
  genreLabels: string[];
  distanceLabel?: string;
  distanceKm?: number;
  ticketLabel?: string;
  featured?: boolean;
  event: EventDisplayModel;
}

export interface MapClub {
  id: string;
  markerType: Extract<MarkerType, 'club'>;
  title: string;
  latitude: number;
  longitude: number;
  cityLabel: string;
  image?: ImageSourcePropType;
  logoReady: boolean;
}

export type MapMarker = MapEvent | MapClub;

export interface MapMarkerSelection {
  type: 'event' | 'club';
  id: string;
}

/** Prepared architecture contracts — clustering and lazy loading are not active yet. */
export interface MapClusteringConfig {
  enabled: boolean;
  minClusterSize: number;
}

export interface MapLazyLoadingConfig {
  enabled: boolean;
  pageSize: number;
}

export interface MapViewportRenderingConfig {
  enabled: boolean;
  debounceMs: number;
}

export const MAP_CLUSTERING_CONFIG: MapClusteringConfig = {
  enabled: false,
  minClusterSize: 4,
};

export const MAP_LAZY_LOADING_CONFIG: MapLazyLoadingConfig = {
  enabled: false,
  pageSize: 24,
};

export const MAP_VIEWPORT_RENDERING_CONFIG: MapViewportRenderingConfig = {
  enabled: false,
  debounceMs: 250,
};
