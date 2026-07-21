import { beforeEach, describe, expect, it } from 'vitest';

import { getLocalStore } from '@/data/datasources/local/local-datasource';
import { AdminEventRepository } from '@/data/repositories/repositories';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';
import type { AdminEventRecord } from '@/data/types/records';

const linkLabels = { website: 'Website', instagram: 'Instagram', facebook: 'Facebook' };

const baseForm: EventDraftFormValues = {
  title: 'Repository Hardening Target',
  startDate: '2026-09-12',
  startTime: '23:00',
  endDate: '',
  endTime: '',
  venueId: '',
  venueText: 'Warehouse',
  genreId: 'techno',
  description: 'Needs admin approval.',
  ticketUrl: '',
  websiteUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  coverImage: null,
  flyerImage: null,
};

function cmsEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  const now = new Date().toISOString();
  return {
    id: 'cms-event-1',
    title: 'CMS Event',
    description: '',
    cityId: 'cologne',
    startDate: now,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AdminEventRepository hardening', () => {
  let repository: AdminEventRepository;

  beforeEach(() => {
    repository = new AdminEventRepository();
    const store = getLocalStore();
    store.adminEvents = store.adminEvents.filter((event) => !event.id.startsWith('draft-'));
  });

  it('blocks illegal CMS editorial transitions', async () => {
    await repository.save(cmsEvent({ id: 'cms-illegal-1', status: 'archived' }));

    await expect(
      repository.save(
        cmsEvent({
          id: 'cms-illegal-1',
          status: 'draft',
        }),
      ),
    ).rejects.toThrow(/invalid status transition/i);
  });

  it('blocks CMS saves for contributor submissions in review', async () => {
    const draft = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'contributor-repo',
      linkLabels,
    });
    const submitted = await contributorEventService.submitForReview({
      eventId: draft.id,
      userId: 'contributor-repo',
    });

    await expect(
      repository.save({
        ...submitted,
        title: 'Edited outside moderation',
      }),
    ).rejects.toThrow(/review workflow/i);
  });

  it('blocks deleting contributor submissions in review', async () => {
    const draft = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'contributor-delete',
      linkLabels,
    });
    const submitted = await contributorEventService.submitForReview({
      eventId: draft.id,
      userId: 'contributor-delete',
    });

    await expect(repository.delete(submitted.id)).rejects.toThrow(/cannot be deleted/i);
  });

  it('allows moderation saves when the event is still in review', async () => {
    const draft = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'contributor-moderate',
      linkLabels,
    });
    const submitted = await contributorEventService.submitForReview({
      eventId: draft.id,
      userId: 'contributor-moderate',
    });

    const published = await repository.save(
      {
        ...submitted,
        status: 'published',
        updatedAt: new Date().toISOString(),
      },
      { source: 'moderation' },
    );

    expect(published.status).toBe('published');
  });

  it('rejects moderation saves when the event is no longer in review', async () => {
    const draft = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'contributor-stale',
      linkLabels,
    });
    const submitted = await contributorEventService.submitForReview({
      eventId: draft.id,
      userId: 'contributor-stale',
    });

    await contributorEventService.withdrawFromReview({
      eventId: submitted.id,
      userId: 'contributor-stale',
    });

    await expect(
      repository.save(
        {
          ...submitted,
          status: 'published',
          updatedAt: new Date().toISOString(),
        },
        { source: 'moderation' },
      ),
    ).rejects.toThrow(/no longer in review/i);
  });
});
