import { Platform } from 'react-native';

import { getGoogleMapsApiKey } from './map-availability';

/**
 * Master switch for native map rendering.
 *
 * Stage A diagnostic builds: set to `false` — MapView is never imported or mounted.
 * Stage B / production: set to `true` — NativeEventMap loads lazily when configuration allows.
 */
export const ENABLE_NATIVE_MAP = true;

/**
 * Returns true when the native Google Maps SDK is configured for Android.
 * iOS does not require an API key for the default Apple Maps provider.
 */
export function isNativeMapConfigured(): boolean {
  if (Platform.OS === 'ios') {
    return true;
  }

  return Boolean(getGoogleMapsApiKey());
}

/**
 * Native MapView may only be mounted when enabled AND properly configured.
 * Mounting MapView on Android without a Google Maps API key causes a native crash.
 */
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
