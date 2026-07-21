import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  requestCurrentUserLocation,
  UserLocationRequestError,
} from '@/features/location/user-location-service';

const mockHasServices = vi.fn();
const mockRequestPermission = vi.fn();
const mockGetCurrentPosition = vi.fn();
const mockReverseGeocode = vi.fn();

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

vi.mock('expo-location', () => ({
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
  Accuracy: {
    Balanced: 3,
  },
  hasServicesEnabledAsync: () => mockHasServices(),
  requestForegroundPermissionsAsync: () => mockRequestPermission(),
  getCurrentPositionAsync: () => mockGetCurrentPosition(),
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocode(...args),
}));

describe('requestCurrentUserLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasServices.mockResolvedValue(true);
    mockRequestPermission.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetCurrentPosition.mockResolvedValue({
      coords: { latitude: 50.9375, longitude: 6.9603 },
    });
    mockReverseGeocode.mockResolvedValue([
      {
        city: 'Köln',
        country: 'Germany',
        isoCountryCode: 'DE',
      },
    ]);
  });

  it('requests permission and resolves a city-country label payload', async () => {
    const result = await requestCurrentUserLocation('de');

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(result.city).toBe('Köln');
    expect(result.countryCode).toBe('DE');
    expect(result.updatedAt).toEqual(expect.any(String));
  });

  it('maps denied permission without retry loops', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'denied', canAskAgain: true });

    await expect(requestCurrentUserLocation('en')).rejects.toMatchObject({
      code: 'permission_denied',
    });
  });

  it('maps permanently blocked permission', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'denied', canAskAgain: false });

    await expect(requestCurrentUserLocation('en')).rejects.toMatchObject({
      code: 'permission_blocked',
    });
  });

  it('keeps coordinates when reverse geocoding has no place names', async () => {
    mockReverseGeocode.mockResolvedValue([{}]);

    const result = await requestCurrentUserLocation('en');
    expect(result.latitude).toBe(50.9375);
    expect(result.longitude).toBe(6.9603);
    expect(result.source).toBe('device');
    expect(result.city).toBeUndefined();
  });
});
