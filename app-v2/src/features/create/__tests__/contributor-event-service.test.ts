import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/core/errors/app-error';
import { getLocalStore } from '@/data/datasources/local/local-datasource';
import {
  mapAdminRecordToEventDraftForm,
} from '@/features/create/mappers/event-draft-mapper';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';

const linkLabels = { website: 'Website', instagram: 'Instagram', facebook: 'Facebook' };

const baseForm: EventDraftFormValues = {
  title: 'Community Rave',
  startDate: '2026-09-12',
  startTime: '23:00',
  endDate: '',
  endTime: '',
  venueId: '',
  venueText: 'Underground Club',
  genreId: 'techno',
  description: 'All night long.',
  ticketUrl: 'https://tickets.example.com',
  websiteUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  coverImage: null,
  flyerImage: null,
};

describe('contributor event service', () => {
  beforeEach(() => {
    const store = getLocalStore();
    store.adminEvents = store.adminEvents.filter((event) => !event.id.startsWith('draft-'));
  });

  it('creates a draft for the authenticated user', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    expect(saved.status).toBe('draft');
    expect(saved.createdBy).toBe('local-user');
    expect(saved.title).toBe('Community Rave');
  });

  it('loads a saved draft for the owner', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    const loaded = await contributorEventService.getEvent(saved.id, 'local-user');
    const foreign = await contributorEventService.getEvent(saved.id, 'other-user');

    expect(loaded?.id).toBe(saved.id);
    expect(foreign).toBeNull();
  });

  it('updates an owned draft', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    const updated = await contributorEventService.updateEvent({
      eventId: saved.id,
      userId: 'local-user',
      linkLabels,
      form: { ...baseForm, title: 'Updated Rave' },
    });

    expect(updated.id).toBe(saved.id);
    expect(updated.title).toBe('Updated Rave');
    expect(updated.createdBy).toBe('local-user');
  });

  it('can reload an updated draft into form values', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await contributorEventService.updateEvent({
      eventId: saved.id,
      userId: 'local-user',
      linkLabels,
      form: { ...baseForm, title: 'Reload me' },
    });

    const loaded = await contributorEventService.getEvent(saved.id, 'local-user');
    expect(loaded).not.toBeNull();

    const form = mapAdminRecordToEventDraftForm(loaded!, linkLabels);
    expect(form.title).toBe('Reload me');
  });

  it('rejects invalid forms before saving', async () => {
    await expect(
      contributorEventService.createEvent({
        form: { ...baseForm, title: '' },
        userId: 'local-user',
        linkLabels,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects updates from non-owners', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await expect(
      contributorEventService.updateEvent({
        eventId: saved.id,
        userId: 'other-user',
        linkLabels,
        form: { ...baseForm, title: 'Hijacked' },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('submits an owned draft for review', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    const submitted = await contributorEventService.submitForReview({
      eventId: saved.id,
      userId: 'local-user',
    });

    expect(submitted.status).toBe('review');
    expect(submitted.createdBy).toBe('local-user');
  });

  it('rejects submit from non-owners', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await expect(
      contributorEventService.submitForReview({
        eventId: saved.id,
        userId: 'other-user',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('does not persist local preview URIs as image URLs', async () => {
    const saved = await contributorEventService.createEvent({
      form: {
        ...baseForm,
        coverImage: {
          remoteUrl: '',
          localUri: 'file:///tmp/cover.jpg',
          mimeType: 'image/jpeg',
        },
      },
      userId: 'local-user',
      linkLabels,
    });

    expect(saved.imageUrl).toBeUndefined();
  });

  it('rejects submit when event is no longer a draft', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await contributorEventService.submitForReview({
      eventId: saved.id,
      userId: 'local-user',
    });

    await expect(
      contributorEventService.submitForReview({
        eventId: saved.id,
        userId: 'local-user',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('lists only owned events sorted by updatedAt', async () => {
    const first = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = await contributorEventService.createEvent({
      form: { ...baseForm, title: 'Second Rave' },
      userId: 'local-user',
      linkLabels,
    });

    await contributorEventService.createEvent({
      form: baseForm,
      userId: 'other-user',
      linkLabels,
    });

    const mine = await contributorEventService.getMyEvents('local-user');

    expect(mine.map((event) => event.id)).toEqual([second.id, first.id]);
    expect(mine.every((event) => event.createdBy === 'local-user')).toBe(true);
  });

  it('filters owned events by status', async () => {
    const draft = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    const submitted = await contributorEventService.submitForReview({
      eventId: draft.id,
      userId: 'local-user',
    });

    const drafts = await contributorEventService.getMyEventsByStatus('local-user', 'draft');
    const reviews = await contributorEventService.getMyEventsByStatus('local-user', 'review');

    expect(drafts).toHaveLength(0);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.id).toBe(submitted.id);
  });

  it('withdraws an owned review event back to draft', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await contributorEventService.submitForReview({
      eventId: saved.id,
      userId: 'local-user',
    });

    const withdrawn = await contributorEventService.withdrawFromReview({
      eventId: saved.id,
      userId: 'local-user',
    });

    expect(withdrawn.status).toBe('draft');
    expect(withdrawn.createdBy).toBe('local-user');
  });

  it('rejects withdraw from non-owners', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await contributorEventService.submitForReview({
      eventId: saved.id,
      userId: 'local-user',
    });

    await expect(
      contributorEventService.withdrawFromReview({
        eventId: saved.id,
        userId: 'other-user',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects withdraw when event is not in review', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await expect(
      contributorEventService.withdrawFromReview({
        eventId: saved.id,
        userId: 'local-user',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects updates while event is in review', async () => {
    const saved = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'local-user',
      linkLabels,
    });

    await contributorEventService.submitForReview({
      eventId: saved.id,
      userId: 'local-user',
    });

    await expect(
      contributorEventService.updateEvent({
        eventId: saved.id,
        userId: 'local-user',
        linkLabels,
        form: { ...baseForm, title: 'Changed in review' },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
