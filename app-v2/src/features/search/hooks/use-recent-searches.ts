import { useCallback, useEffect, useState } from 'react';

import type { RecentSearchViewModel } from '@/components/search/view-models';

import {
  loadRecentSearches,
  removeRecentSearch,
  type RecentSearchRecord,
} from '../services/recent-search-storage';

function toViewModel(record: RecentSearchRecord): RecentSearchViewModel {
  return {
    id: record.id,
    title: record.query,
    accessibilityLabel: `Letzte Suche ${record.query}`,
  };
}

export function useRecentSearches() {
  const [items, setItems] = useState<RecentSearchViewModel[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const records = await loadRecentSearches();
      setItems(records.map(toViewModel));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const records = await loadRecentSearches();
        if (!cancelled) {
          setItems(records.map(toViewModel));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const remove = useCallback(async (id: string) => {
    const next = await removeRecentSearch(id);
    setItems(next.map(toViewModel));
  }, []);

  return { items, loading, refresh, remove };
}
