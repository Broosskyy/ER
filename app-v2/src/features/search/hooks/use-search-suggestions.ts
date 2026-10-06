import { useCallback, useEffect, useRef, useState } from 'react';

import { useUserLocation } from '@/features/location/UserLocationProvider';

import { loadDiscoverySearchSuggestions } from '../feed/discovery-search-client';
import type { DiscoverySearchSuggestion } from '../feed/search-feed-types';

export function useSearchSuggestions(query: string, enabled = true) {
  const { location } = useUserLocation();
  const [suggestions, setSuggestions] = useState<DiscoverySearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const requestVersionRef = useRef(0);

  const load = useCallback(async () => {
    const normalized = query.trim();
    if (!enabled || normalized.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    setLoading(true);

    try {
      const result = await loadDiscoverySearchSuggestions(normalized, {
        city: location?.city,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });

      if (requestVersion === requestVersionRef.current) {
        setSuggestions(result);
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, location?.city, location?.latitude, location?.longitude, query]);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        void load();
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [load]);

  return { suggestions, loading };
}
