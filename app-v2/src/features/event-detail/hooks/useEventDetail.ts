import { useCallback, useEffect, useRef, useState } from 'react';

import type { EventCardViewModel } from '@/components/discovery/view-models';
import { DiscoveryApiError } from '@/features/discovery/api/domain/discovery-api-errors';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { useNetworkStatus } from '@/platform/network/use-network-status';

import {
  getCachedEventDetail,
  loadEventDetail,
  loadSimilarEvents,
} from '../feed/discovery-event-detail-client';
import { trackEventDetailTelemetry } from '../feed/event-detail-telemetry';

export type EventDetailErrorKind = 'not_found' | 'archived' | 'network' | 'unknown';

export interface UseEventDetailResult {
  event: EventDisplayModel | undefined;
  similarEvents: EventCardViewModel[];
  loading: boolean;
  similarLoading: boolean;
  error: string | null;
  errorKind: EventDetailErrorKind | null;
  isOnline: boolean;
  fromCache: boolean;
  retry: () => Promise<void>;
  refreshSimilar: () => Promise<void>;
}

function resolveErrorKind(error: unknown): EventDetailErrorKind {
  if (error instanceof DiscoveryApiError && error.code === 'NOT_FOUND') {
    return 'not_found';
  }

  if (error instanceof Error && error.message.toLowerCase().includes('network')) {
    return 'network';
  }

  return 'unknown';
}

export function useEventDetail(eventId: string | undefined): UseEventDetailResult {
  const { isOnline } = useNetworkStatus();
  const [event, setEvent] = useState<EventDisplayModel | undefined>(() =>
    eventId ? getCachedEventDetail(eventId) : undefined,
  );
  const [similarEvents, setSimilarEvents] = useState<EventCardViewModel[]>([]);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [similarLoading, setSimilarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<EventDetailErrorKind | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const loadVersionRef = useRef(0);

  const loadSimilar = useCallback(async (loadedEvent: EventDisplayModel) => {
    setSimilarLoading(true);
    try {
      const result = await loadSimilarEvents(loadedEvent);
      setSimilarEvents(result.events);
    } catch {
      setSimilarEvents([]);
    } finally {
      setSimilarLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!eventId) {
      setEvent(undefined);
      setLoading(false);
      setError('Event nicht gefunden.');
      setErrorKind('not_found');
      return;
    }

    const loadVersion = ++loadVersionRef.current;
    setLoading(true);
    setError(null);
    setErrorKind(null);

    try {
      const result = await loadEventDetail(eventId, { bypassCache: false });
      if (loadVersion !== loadVersionRef.current) {
        return;
      }

      if (result.event.lifecycleStatus === 'archived' || result.event.status === 'archived') {
        setError('Dieses Event ist nicht mehr verfügbar.');
        setErrorKind('archived');
        setEvent(undefined);
        return;
      }

      setEvent(result.event);
      setFromCache(result.fromCache);
      trackEventDetailTelemetry('detail_opened', { eventId });
      void loadSimilar(result.event);
    } catch (loadError) {
      if (loadVersion !== loadVersionRef.current) {
        return;
      }

      const cached = getCachedEventDetail(eventId);
      if (!isOnline && cached) {
        setEvent(cached);
        setFromCache(true);
        setError(null);
        setErrorKind(null);
        void loadSimilar(cached);
        return;
      }

      const kind = resolveErrorKind(loadError);
      setErrorKind(kind);
      setError(
        kind === 'not_found'
          ? 'Event nicht gefunden.'
          : !isOnline
            ? 'Keine Internetverbindung.'
            : 'Event konnte nicht geladen werden.',
      );
      setEvent(undefined);
    } finally {
      if (loadVersion === loadVersionRef.current) {
        setLoading(false);
      }
    }
  }, [eventId, isOnline, loadSimilar]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (cancelled) {
        return;
      }
      await load();
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const retry = useCallback(async () => {
    trackEventDetailTelemetry('detail_retry', { eventId });
    if (!eventId) {
      return;
    }
    setLoading(true);
    setError(null);
    setErrorKind(null);
    try {
      const result = await loadEventDetail(eventId, { bypassCache: true });
      if (result.event.lifecycleStatus === 'archived' || result.event.status === 'archived') {
        setError('Dieses Event ist nicht mehr verfügbar.');
        setErrorKind('archived');
        setEvent(undefined);
        return;
      }
      setEvent(result.event);
      setFromCache(false);
      void loadSimilar(result.event);
    } catch (loadError) {
      const kind = resolveErrorKind(loadError);
      setErrorKind(kind);
      setError(kind === 'not_found' ? 'Event nicht gefunden.' : 'Event konnte nicht geladen werden.');
      setEvent(undefined);
    } finally {
      setLoading(false);
    }
  }, [eventId, loadSimilar]);

  const refreshSimilar = useCallback(async () => {
    if (!event) {
      return;
    }
    await loadSimilar(event);
  }, [event, loadSimilar]);

  return {
    event,
    similarEvents,
    loading,
    similarLoading,
    error,
    errorKind,
    isOnline,
    fromCache,
    retry,
    refreshSimilar,
  };
}
