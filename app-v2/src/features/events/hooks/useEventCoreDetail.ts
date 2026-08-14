import { useEffect, useState } from 'react';

import { toEventDisplayModelFromDetail } from '@/data/mappers/event-core-display';
import { eventRepository } from '@/data/repositories/registry';
import type { EventDetail } from '@/features/events/types/event-core';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

export type EventCoreDetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; detail: EventDetail; display: EventDisplayModel }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export function useEventCoreDetail(eventId: string | undefined): EventCoreDetailState {
  const [state, setState] = useState<EventCoreDetailState>(() => {
    if (!eventId) {
      return { status: 'not_found' };
    }

    const cached = eventRepository.getPublishedDetail(eventId);
    if (cached) {
      return {
        status: 'ready',
        detail: cached,
        display: toEventDisplayModelFromDetail(cached),
      };
    }

    return { status: 'loading' };
  });

  useEffect(() => {
    if (!eventId) {
      setState({ status: 'not_found' });
      return;
    }

    const cached = eventRepository.getPublishedDetail(eventId);
    if (cached) {
      setState({
        status: 'ready',
        detail: cached,
        display: toEventDisplayModelFromDetail(cached),
      });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    void eventRepository
      .fetchPublishedDetailById(eventId)
      .then((detail) => {
        if (cancelled) {
          return;
        }

        if (!detail) {
          setState({ status: 'not_found' });
          return;
        }

        setState({
          status: 'ready',
          detail,
          display: toEventDisplayModelFromDetail(detail),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error', message: 'Event konnte nicht geladen werden.' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return state;
}
