import { useEffect, useMemo, useState } from 'react';

import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { Event as DomainEvent } from '@/features/events/types/event';

import {
  loadEventDetailEntities,
  type EventDetailEntities,
} from '../services/event-detail-entity-loader';

export interface EventDetailEntitySource {
  organizerId?: string;
  venueId?: string;
  artistIds?: string[];
}

const EMPTY_ENTITIES: EventDetailEntities = {
  organizer: null,
  venue: null,
  artistsById: new Map(),
};

function toEntityEvent(source: EventDetailEntitySource): DomainEvent | undefined {
  if (!source.organizerId && !source.venueId && !(source.artistIds?.length ?? 0)) {
    return undefined;
  }

  return {
    id: 'detail-entity-source',
    slug: 'detail-entity-source',
    title: '',
    description: '',
    startDateTime: new Date().toISOString(),
    timezone: 'Europe/Berlin',
    venue: '',
    city: '',
    country: '',
    genres: [],
    artists: [],
    organizerId: source.organizerId,
    venueId: source.venueId,
    artistIds: source.artistIds,
    source: 'detail',
    sourceEventId: 'detail-entity-source',
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function useEventDetailEntities(event: DomainEvent | EventDisplayModel | undefined) {
  const [entities, setEntities] = useState<EventDetailEntities>(EMPTY_ENTITIES);
  const [loading, setLoading] = useState(Boolean(event));

  const entitySource = useMemo<EventDetailEntitySource | undefined>(() => {
    if (!event) {
      return undefined;
    }
    return {
      organizerId: event.organizerId,
      venueId: event.venueId,
      artistIds: event.artistIds,
    };
  }, [event]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const sourceEvent = entitySource ? toEntityEvent(entitySource) : undefined;
      if (!sourceEvent) {
        setEntities(EMPTY_ENTITIES);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const loaded = await loadEventDetailEntities(sourceEvent);
        if (!cancelled) {
          setEntities(loaded);
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
  }, [entitySource]);

  return { entities, loading };
}
