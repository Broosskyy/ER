import { Platform } from 'react-native';

import { getGoogleMapsApiKey } from './map-availability';

/**
 * Native map rendering is disabled for V1 until Google Maps is fully configured.
 */
export const ENABLE_NATIVE_MAP = false;

export function isNativeMapConfigured(): boolean {
  if (Platform.OS === 'ios') {
    return true;
  }

  return Boolean(getGoogleMapsApiKey());
}

export function canMountNativeMapView(): boolean {
  return ENABLE_NATIVE_MAP && isNativeMapConfigured();
}

export function getMapConfigurationStatus(): {
  enableNativeMap: boolean;
  isConfigured: boolean;
  canMount: boolean;
  hasGoogleMapsApiKey: boolean;
} {
  const hasGoogleMapsApiKey = Boolean(getGoogleMapsApiKey());

  return {
    enableNativeMap: ENABLE_NATIVE_MAP,
    isConfigured: isNativeMapConfigured(),
    canMount: canMountNativeMapView(),
    hasGoogleMapsApiKey,
  };
}
