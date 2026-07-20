import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { resolveLocationDisplayLabel } from '@/features/location/resolve-location-display';
import {
  loadStoredUserLocation,
  saveStoredUserLocation,
} from '@/features/location/user-location-storage';
import { requestCurrentUserLocation, UserLocationRequestError } from '@/features/location/user-location-service';
import type {
  UserLocationErrorCode,
  UserLocationRecord,
  UserLocationUiStatus,
} from '@/features/location/types/user-location';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface UserLocationContextValue {
  location: UserLocationRecord | null;
  status: UserLocationUiStatus;
  displayLabel: string;
  errorCode: UserLocationErrorCode | null;
  loading: boolean;
  requestCurrentLocation: () => Promise<boolean>;
}

const UserLocationContext = createContext<UserLocationContextValue | null>(null);

function mapErrorToCode(error: unknown): UserLocationErrorCode {
  if (error instanceof UserLocationRequestError) {
    return error.code;
  }

  return 'resolve_failed';
}

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const { t, locale } = useAppTranslation();
  const [location, setLocation] = useState<UserLocationRecord | null>(null);
  const [status, setStatus] = useState<UserLocationUiStatus>('initial');
  const [errorCode, setErrorCode] = useState<UserLocationErrorCode | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    void loadStoredUserLocation().then((stored) => {
      if (!active) {
        return;
      }

      if (stored) {
        setLocation(stored);
        setStatus('ready');
      }

      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const requestCurrentLocation = useCallback(async (): Promise<boolean> => {
    if (status === 'loading') {
      return false;
    }

    setStatus('loading');
    setErrorCode(null);

    try {
      const resolved = await requestCurrentUserLocation(locale);
      await saveStoredUserLocation(resolved);
      setLocation(resolved);
      setStatus('ready');
      return true;
    } catch (cause) {
      const code = mapErrorToCode(cause);
      setErrorCode(code);
      setStatus(code === 'permission_denied' || code === 'permission_blocked' ? 'denied' : 'error');
      return false;
    }
  }, [locale, status]);

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
    }),
    [displayLabel, errorCode, hydrated, location, requestCurrentLocation, status],
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
