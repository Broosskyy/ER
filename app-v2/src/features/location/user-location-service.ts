import { Platform } from 'react-native';
import * as Location from 'expo-location';

import type { UserLocationRecord } from '@/features/location/types/user-location';
import type { UserLocationErrorCode } from '@/features/location/types/user-location';

export class UserLocationRequestError extends Error {
  readonly code: UserLocationErrorCode;

  constructor(code: UserLocationErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'UserLocationRequestError';
    this.code = code;
  }
}

interface ReverseGeocodeResult {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
}

async function reverseGeocodeNative(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  const results = await Location.reverseGeocodeAsync({ latitude, longitude });
  const first = results[0];

  if (!first) {
    return {};
  }

  return {
    city: first.city ?? first.subregion ?? first.district ?? undefined,
    region: first.region ?? first.subregion ?? undefined,
    country: first.country ?? undefined,
    countryCode: first.isoCountryCode ?? undefined,
  };
}

async function reverseGeocodeWeb(
  latitude: number,
  longitude: number,
  locale: string,
): Promise<ReverseGeocodeResult> {
  const language = locale.startsWith('de') ? 'de' : 'en';
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('accept-language', language);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'EternalRave/0.2.0 (location-picker)',
    },
  });

  if (!response.ok) {
    throw new UserLocationRequestError('resolve_failed');
  }

  const data = (await response.json()) as {
    address?: {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      state?: string;
      country?: string;
      country_code?: string;
    };
  };

  const address = data.address;
  if (!address) {
    return {};
  }

  const city =
    address.city ?? address.town ?? address.village ?? address.municipality ?? undefined;

  return {
    city,
    region: address.state,
    country: address.country,
    countryCode: address.country_code?.toUpperCase(),
  };
}

async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
  locale: string,
): Promise<ReverseGeocodeResult> {
  if (Platform.OS === 'web') {
    return reverseGeocodeWeb(latitude, longitude, locale);
  }

  return reverseGeocodeNative(latitude, longitude);
}

export async function requestCurrentUserLocation(locale: string): Promise<UserLocationRecord> {
  if (Platform.OS === 'web' && typeof navigator === 'undefined') {
    throw new UserLocationRequestError('unavailable');
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new UserLocationRequestError('unavailable');
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    if (permission.canAskAgain === false) {
      throw new UserLocationRequestError('permission_blocked');
    }
    throw new UserLocationRequestError('permission_denied');
  }

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    throw new UserLocationRequestError('unavailable');
  }

  let geocoded: ReverseGeocodeResult;
  try {
    geocoded = await reverseGeocodeCoordinates(
      position.coords.latitude,
      position.coords.longitude,
      locale,
    );
  } catch (cause) {
    if (cause instanceof UserLocationRequestError) {
      throw cause;
    }
    throw new UserLocationRequestError('resolve_failed');
  }

  if (!geocoded.city && !geocoded.region && !geocoded.country) {
    throw new UserLocationRequestError('resolve_failed');
  }

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    city: geocoded.city,
    region: geocoded.region,
    country: geocoded.country,
    countryCode: geocoded.countryCode,
    updatedAt: new Date().toISOString(),
  };
}
