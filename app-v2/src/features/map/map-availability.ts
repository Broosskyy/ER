import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getGoogleMapsApiKey(): string | undefined {
  const fromExpo = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const key = typeof fromExpo === 'string' && fromExpo.trim().length > 0 ? fromExpo : fromEnv;

  return key && key.trim().length > 0 ? key.trim() : undefined;
}

export function isAndroidMapConfigured(): boolean {
  if (Platform.OS !== 'android') {
    return true;
  }

  return Boolean(getGoogleMapsApiKey());
}
