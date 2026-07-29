import { useCallback, useEffect, useState } from 'react';

import type { ProfileHeaderViewModel } from '@/components/profiles/view-models';
import type { EntityProfileEvents } from '@/features/events/domain/entity-profile-events-service';
import type { FollowEntityType } from '@/features/follows/follow-service';
import type { ArtistRecord, OrganizerRecord, VenueRecord } from '@/data/types/records';

import { loadEntityProfile } from '@/features/profiles/services/entity-profile-loader';
import {
  toArtistProfileHeader,
  toOrganizerProfileHeader,
  toVenueProfileHeader,
} from '@/features/profiles/utils/profile-view-models';

export type EntityProfileLoadState = 'loading' | 'ready' | 'not_found' | 'error';

export interface UseEntityProfileResult {
  state: EntityProfileLoadState;
  canonicalId: string | null;
  header: ProfileHeaderViewModel | null;
  record: OrganizerRecord | VenueRecord | ArtistRecord | null;
  events: EntityProfileEvents | null;
  error: string | null;
  retry: () => void;
}

function countProfileEvents(events: EntityProfileEvents): number {
  return events.upcoming.length + events.happeningNow.length + events.past.length;
}

function toHeader(
  entityType: FollowEntityType,
  record: OrganizerRecord | VenueRecord | ArtistRecord,
  events: EntityProfileEvents,
): ProfileHeaderViewModel {
  const eventCount = countProfileEvents(events);
  if (entityType === 'organizer') {
    return toOrganizerProfileHeader(record as OrganizerRecord, eventCount);
  }
  if (entityType === 'venue') {
    return toVenueProfileHeader(record as VenueRecord, eventCount);
  }
  const artist = record as ArtistRecord;
  return toArtistProfileHeader(artist, eventCount, []);
}

export function useEntityProfile(
  entityType: FollowEntityType,
  rawId?: string,
): UseEntityProfileResult {
  const [state, setState] = useState<EntityProfileLoadState>('loading');
  const [canonicalId, setCanonicalId] = useState<string | null>(null);
  const [header, setHeader] = useState<ProfileHeaderViewModel | null>(null);
  const [record, setRecord] = useState<OrganizerRecord | VenueRecord | ArtistRecord | null>(null);
  const [events, setEvents] = useState<EntityProfileEvents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!rawId) {
        setState('not_found');
        return;
      }

      setState('loading');
      setError(null);

      try {
        const loaded = await loadEntityProfile(entityType, rawId);
        if (cancelled) {
          return;
        }

        if (!loaded) {
          setState('not_found');
          setCanonicalId(null);
          setHeader(null);
          setRecord(null);
          setEvents(null);
          return;
        }

        setCanonicalId(loaded.canonicalId);
        setRecord(loaded.record);
        setEvents(loaded.events);
        setHeader(toHeader(entityType, loaded.record, loaded.events));
        setState('ready');
      } catch (cause) {
        if (!cancelled) {
          setState('error');
          setError(cause instanceof Error ? cause.message : 'Profil konnte nicht geladen werden.');
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [attempt, entityType, rawId]);

  return {
    state,
    canonicalId,
    header,
    record,
    events,
    error,
    retry,
  };
}
