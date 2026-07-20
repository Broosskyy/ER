import { useEffect, useState } from 'react';

import type { GenreRecord, VenueRecord } from '@/data/types/records';
import { genreRepository, venueRepository } from '@/data/repositories/registry';

export interface EventDraftReferenceData {
  genreOptions: Array<{ id: string; label: string }>;
  venues: VenueRecord[];
}

export function useEventDraftReferenceData(): {
  data: EventDraftReferenceData;
  loading: boolean;
} {
  const [data, setData] = useState<EventDraftReferenceData>({ genreOptions: [], venues: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [genres, venues] = await Promise.all([
          genreRepository.getActive(),
          venueRepository.getAll(),
        ]);

        if (cancelled) {
          return;
        }

        setData({
          genreOptions: genres.map((genre: GenreRecord) => ({ id: genre.id, label: genre.name })),
          venues,
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
