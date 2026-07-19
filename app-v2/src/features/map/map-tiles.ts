/** Map load timeout before showing the JavaScript error state. */
export function getMapLoadTimeoutMs(): number {
  return 15000;
}

/** @deprecated OSM tiles still require MapView on Android and crash without Google Maps SDK config. */
export function shouldUseOsmMapTiles(): boolean {
  return false;
}

/** @deprecated */
export const OSM_TILE_URL_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** @deprecated */
export const OSM_TILE_MAX_ZOOM = 19;
