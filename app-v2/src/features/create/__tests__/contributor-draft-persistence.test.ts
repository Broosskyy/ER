import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLocalStore, resetLocalContributorHydrationForTesting } from '@/data/datasources/local/local-datasource';
import { getDatasourceBundle } from '@/data/datasources/supabase/supabase-datasource';
import {
  loadPersistedContributorEvents,
  savePersistedContributorEvents,
} from '@/data/datasources/local/local-contributor-event-storage';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: (key: string) => Promise.resolve(storage.get(key) ?? null),
    setItem: (key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      storage.delete(key);
      return Promise.resolve();
    },
  },
}));

const linkLabels = { website: 'Website', instagram: 'Instagram', facebook: 'Facebook' };

const baseForm: EventDraftFormValues = {
  title: 'Reload Test',
  startDate: '2026-09-12',
  startTime: '23:00',
  endDate: '',
  endTime: '',
  venueId: '',
  venueText: 'Warehouse',
  genreId: 'techno',
  description: 'Persist me.',
  ticketUrl: '',
  websiteUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  coverImage: null,
  flyerImage: null,
};

describe('contributor draft persistence across reload', () => {
  beforeEach(() => {
    storage.clear();
    resetLocalContributorHydrationForTesting();
    const store = getLocalStore();
    store.adminEvents = store.adminEvents.filter((event) => !event.id.startsWith('draft-'));
  });

  it('survives simulated reload via persisted storage', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    const persisted = await loadPersistedContributorEvents();
    expect(persisted.some((event) => event.id === saved.id)).toBe(true);

    resetLocalContributorHydrationForTesting();
    const reloaded = await contributorEventService.getEvent(saved.id, 'local-user');
    expect(reloaded?.title).toBe('Reload Test');
  });

  it('reuses draft id on subsequent saves in create flow', async () => {
    const first = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    const second = await contributorEventService.createEvent({
      form: { ...baseForm, title: 'Updated title' },
      userId: 'local-user',
      linkLabels,
      eventId: first.id,
    });

    expect(second.id).toBe(first.id);
    expect(second.title).toBe('Updated title');
  });

  it('persists archived status after deleteEvent', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await getDatasourceBundle().events.deleteEvent(saved.id);

    const persisted = await loadPersistedContributorEvents();
    const archived = persisted.find((event) => event.id === saved.id);
    expect(archived?.status).toBe('archived');

    resetLocalContributorHydrationForTesting();
    const reloaded = await contributorEventService.getEvent(saved.id, 'local-user');
    expect(reloaded?.status).toBe('archived');
  });
});
