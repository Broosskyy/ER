import { Platform } from 'react-native';
import * as Location from 'expo-location';

import type { UserLocationRecord } from '@/features/location/types/user-location';
import type { UserLocationErrorCode } from '@/features/location/types/user-location';
import { withTimeout } from '@/features/location/utils/with-timeout';

export class UserLocationRequestError extends Error {
  readonly code: UserLocationErrorCode;

  constructor(code: UserLocationErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'UserLocationRequestError';
    this.code = code;
  }
}

const GPS_TIMEOUT_MS = 15_000;
const GEOCODE_TIMEOUT_MS = 10_000;
const NOMINATIM_RETRY_DELAY_MS = 1_100;

interface ReverseGeocodeResult {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
}

function assertSecureWebContext(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext) {
    throw new UserLocationRequestError('unavailable');
  }
}

async function reverseGeocodeNative(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  const results = await withTimeout(
    Location.reverseGeocodeAsync({ latitude, longitude }),
    GEOCODE_TIMEOUT_MS,
  );
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

async function fetchNominatim(
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

  const response = await withTimeout(
    fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EternalRave/0.2.0 (location-picker)',
      },
    }),
    GEOCODE_TIMEOUT_MS,
  );

  if (response.status === 429) {
    throw new UserLocationRequestError('network');
  }

  if (!response.ok) {
    throw new UserLocationRequestError('network');
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

async function reverseGeocodeWeb(
  latitude: number,
  longitude: number,
  locale: string,
): Promise<ReverseGeocodeResult> {
  try {
    return await fetchNominatim(latitude, longitude, locale);
  } catch (cause) {
    if (cause instanceof UserLocationRequestError) {
      if (cause.code === 'network') {
        await new Promise((resolve) => setTimeout(resolve, NOMINATIM_RETRY_DELAY_MS));
        return fetchNominatim(latitude, longitude, locale);
      }
      throw cause;
    }

    throw new UserLocationRequestError('network');
  }
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

function buildRecordFromPosition(
  position: Location.LocationObject,
  geocoded: ReverseGeocodeResult,
): UserLocationRecord {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    city: geocoded.city,
    region: geocoded.region,
    country: geocoded.country,
    countryCode: geocoded.countryCode,
    updatedAt: new Date().toISOString(),
    source: 'device',
  };
}

export async function requestCurrentUserLocation(locale: string): Promise<UserLocationRecord> {
  if (Platform.OS === 'web' && typeof navigator === 'undefined') {
    throw new UserLocationRequestError('unavailable');
  }

  assertSecureWebContext();

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
    position = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      GPS_TIMEOUT_MS,
    );
  } catch {
    throw new UserLocationRequestError('unavailable');
  }

  let geocoded: ReverseGeocodeResult = {};
  try {
    geocoded = await reverseGeocodeCoordinates(
      position.coords.latitude,
      position.coords.longitude,
      locale,
    );
  } catch (cause) {
    if (cause instanceof UserLocationRequestError && cause.code === 'network') {
      return buildRecordFromPosition(position, {});
    }
    if (cause instanceof UserLocationRequestError) {
      throw cause;
    }
    // Geocode failed but GPS succeeded — keep coordinates without place names.
  }

  return buildRecordFromPosition(position, geocoded);
}

export function buildManualDiscoveryLocation(input: {
  cityId: string;
  cityLabel: string;
  country?: string;
  latitude: number;
  longitude: number;
}): UserLocationRecord {
  return {
    latitude: input.latitude,
    longitude: input.longitude,
    city: input.cityLabel,
    country: input.country ?? 'Germany',
    updatedAt: new Date().toISOString(),
    source: 'manual',
    discoveryCityId: input.cityId,
  };
}
