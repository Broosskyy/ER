import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_HOME_RADIUS_KM,
  HOME_RADIUS_OPTIONS,
  loadHomeRadiusKm,
  saveHomeRadiusKm,
  type HomeRadiusKm,
} from '../home-location-preferences';

export function useHomeRadiusPreference(): {
  radiusKm: HomeRadiusKm;
  options: readonly HomeRadiusKm[];
  setRadiusKm: (radiusKm: HomeRadiusKm) => Promise<void>;
  hydrated: boolean;
} {
  const [radiusKm, setRadiusKmState] = useState<HomeRadiusKm>(DEFAULT_HOME_RADIUS_KM);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    void loadHomeRadiusKm().then((stored) => {
      if (active) {
        setRadiusKmState(stored);
        setHydrated(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const setRadiusKm = useCallback(async (next: HomeRadiusKm) => {
    setRadiusKmState(next);
    await saveHomeRadiusKm(next);
  }, []);

  return {
    radiusKm,
    options: HOME_RADIUS_OPTIONS,
    setRadiusKm,
    hydrated,
  };
}
