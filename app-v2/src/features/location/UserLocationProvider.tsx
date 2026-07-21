import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { resolveLocationDisplayLabel } from '@/features/location/resolve-location-display';
import {
  buildManualDiscoveryLocation,
  requestCurrentUserLocation,
  UserLocationRequestError,
} from '@/features/location/user-location-service';
import {
  loadStoredUserLocation,
  saveStoredUserLocation,
} from '@/features/location/user-location-storage';
import type {
  UserLocationErrorCode,
  UserLocationRecord,
  UserLocationUiStatus,
} from '@/features/location/types/user-location';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface ManualDiscoveryCityOption {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  country?: string;
}

export interface UserLocationContextValue {
  location: UserLocationRecord | null;
  status: UserLocationUiStatus;
  displayLabel: string;
  errorCode: UserLocationErrorCode | null;
  loading: boolean;
  requestCurrentLocation: () => Promise<boolean>;
  selectDiscoveryCity: (city: ManualDiscoveryCityOption) => Promise<boolean>;
}

const UserLocationContext = createContext<UserLocationContextValue | null>(null);

function mapErrorToCode(error: unknown): UserLocationErrorCode {
  if (error instanceof UserLocationRequestError) {
    return error.code;
  }

  return 'resolve_failed';
}

async function persistLocation(record: UserLocationRecord): Promise<void> {
  try {
    await saveStoredUserLocation(record);
  } catch {
    // Non-fatal: in-memory location still usable for the session.
  }
}

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const { t, locale } = useAppTranslation();
  const [location, setLocation] = useState<UserLocationRecord | null>(null);
  const [status, setStatus] = useState<UserLocationUiStatus>('initial');
  const [errorCode, setErrorCode] = useState<UserLocationErrorCode | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;

    void loadStoredUserLocation()
      .then((stored) => {
        if (!active) {
          return;
        }

        if (stored) {
          setLocation({ ...stored, source: stored.source ?? 'stored' });
          setStatus('ready');
        }
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const requestCurrentLocation = useCallback(async (): Promise<boolean> => {
    if (requestInFlightRef.current) {
      return false;
    }

    requestInFlightRef.current = true;
    setStatus('loading');
    setErrorCode(null);

    try {
      const resolved = await requestCurrentUserLocation(locale);
      setLocation(resolved);
      await persistLocation(resolved);
      setStatus('ready');
      return true;
    } catch (cause) {
      const code = mapErrorToCode(cause);
      setErrorCode(code);
      setStatus(code === 'permission_denied' || code === 'permission_blocked' ? 'denied' : 'error');
      return false;
    } finally {
      requestInFlightRef.current = false;
    }
  }, [locale]);

  const selectDiscoveryCity = useCallback(async (city: ManualDiscoveryCityOption): Promise<boolean> => {
    if (requestInFlightRef.current) {
      return false;
    }

    requestInFlightRef.current = true;
    setStatus('loading');
    setErrorCode(null);

    try {
      const resolved = buildManualDiscoveryLocation({
        cityId: city.id,
        cityLabel: city.label,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude,
      });
      setLocation(resolved);
      await persistLocation(resolved);
      setStatus('ready');
      return true;
    } catch {
      setErrorCode('resolve_failed');
      setStatus('error');
      return false;
    } finally {
      requestInFlightRef.current = false;
    }
  }, []);

  const displayLabel = useMemo(
    () =>
      resolveLocationDisplayLabel(hydrated ? status : 'initial', location, locale, {
        choose: t('home.location.choose'),
        loading: t('home.location.loading'),
      }),
    [hydrated, location, locale, status, t],
  );

  const value = useMemo(
    () => ({
      location,
      status: hydrated ? status : 'initial',
      displayLabel,
      errorCode,
      loading: status === 'loading',
      requestCurrentLocation,
      selectDiscoveryCity,
    }),
    [displayLabel, errorCode, hydrated, location, requestCurrentLocation, selectDiscoveryCity, status],
  );

  return <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>;
}

export function useUserLocation(): UserLocationContextValue {
  const context = useContext(UserLocationContext);
  if (!context) {
    throw new Error('useUserLocation must be used within UserLocationProvider');
  }
  return context;
}
