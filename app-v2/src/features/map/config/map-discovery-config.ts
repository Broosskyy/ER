import type { MapLayerType, MapRadiusKm, MapSortOption } from '../types/discovery-models';

export interface MapDiscoveryOption<T extends string | number> {
  id: T;
  label: string;
}

export const MAP_RADIUS_OPTIONS: MapDiscoveryOption<MapRadiusKm>[] = [
  { id: 5, label: '5 km' },
  { id: 10, label: '10 km' },
  { id: 25, label: '25 km' },
  { id: 50, label: '50 km' },
  { id: 100, label: '100 km' },
  { id: 'unlimited', label: 'Unbegrenzt' },
];

export const MAP_LAYER_OPTIONS: MapDiscoveryOption<MapLayerType>[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'dark', label: 'Dark Mode' },
];

export const MAP_SORT_OPTIONS: MapDiscoveryOption<MapSortOption>[] = [
  { id: 'distance', label: 'Entfernung' },
  { id: 'popular', label: 'Beliebt' },
  { id: 'new', label: 'Neu' },
  { id: 'date', label: 'Datum' },
];
