import { beforeEach, describe, expect, it } from 'vitest';

import { getLocalStore } from '@/data/datasources/local/local-datasource';
import { AdminEventRepository } from '@/data/repositories/repositories';
import { AdminEventModerationService } from '@/features/admin/services/admin-event-moderation-service';
import { AdminModerationStateService } from '@/features/admin/services/admin-moderation-state-service';
import { EventModerationAuditService } from '@/features/admin/services/event-moderation-audit-service';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';
import type { AuthSession } from '@/services/supabase/auth-service';

const linkLabels = { website: 'Website', instagram: 'Instagram', facebook: 'Facebook' };

const baseForm: EventDraftFormValues = {
  title: 'Moderation Target',
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

const adminSession: AuthSession = {
  user: { id: 'admin-user', email: 'admin@test.com' },
  accessToken: 'token',
  role: 'admin',
};

const editorSession: AuthSession = {
  user: { id: 'editor-user', email: 'editor@test.com' },
  accessToken: 'token',
  role: 'editor',
};

describe('event moderation audit service', () => {
  it('records publish and reject actions', async () => {
    const audit = new EventModerationAuditService();
    await audit.logPublished('admin-1', 'event-1', 'Rave Night');
    await audit.logRejected('admin-1', 'event-2', 'Bad Data', 'Missing venue');

    expect(audit.listAll()).toHaveLength(2);
    expect(audit.listByEvent('event-2')[0]?.action).toBe('event_rejected');
    expect(audit.listByEvent('event-2')[0]?.note).toBe('Missing venue');
  });
});

describe('admin event moderation service', () => {
  let moderationService: AdminEventModerationService;
  let auditService: EventModerationAuditService;
  let stateService: AdminModerationStateService;

  beforeEach(() => {
    const store = getLocalStore();
    store.adminEvents = store.adminEvents.filter((event) => !event.id.startsWith('draft-'));
    auditService = new EventModerationAuditService();
    stateService = new AdminModerationStateService();
    stateService.clear();
    moderationService = new AdminEventModerationService(
      new AdminEventRepository(),
      auditService,
      stateService,
    );
  });

  async function createReviewEvent(): Promise<string> {
    const draft = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'contributor-1',
      linkLabels,
    });
    const submitted = await contributorEventService.submitForReview({
      eventId: draft.id,
      userId: 'contributor-1',
    });
    return submitted.id;
  }

  it('lists contributor events in review', async () => {
    const eventId = await createReviewEvent();
    const queue = await moderationService.listReviewQueue(adminSession);

    expect(queue.some((event) => event.id === eventId)).toBe(true);
    expect(queue.every((event) => event.status === 'review')).toBe(true);
    expect(queue.every((event) => Boolean(event.createdBy))).toBe(true);
  });

  it('approves without publishing immediately', async () => {
    const eventId = await createReviewEvent();
    const approved = await moderationService.approveContributorEvent(adminSession, eventId);

    expect(approved.status).toBe('review');
    const state = await stateService.getState(eventId);
    expect(state?.queueStatus).toBe('approved');
    expect(auditService.listByEvent(eventId)[0]?.action).toBe('event_approved');
  });

  it('publishes only approved events', async () => {
    const eventId = await createReviewEvent();
    await moderationService.approveContributorEvent(adminSession, eventId);
    const published = await moderationService.publishContributorEvent(adminSession, eventId);

    expect(published.status).toBe('published');
    expect(auditService.listByEvent(eventId).some((entry) => entry.action === 'event_published')).toBe(
      true,
    );
  });

  it('requests changes and sets rejected status', async () => {
    const eventId = await createReviewEvent();
    const updated = await moderationService.requestChangesContributorEvent(adminSession, eventId, {
      reasonCode: 'incomplete_data',
      note: 'Line-up fehlt',
    });

    expect(updated.status).toBe('rejected');
    const state = await stateService.getState(eventId);
    expect(state?.queueStatus).toBe('needs_changes');
    expect(auditService.listByEvent(eventId)[0]?.action).toBe('changes_requested');
  });

  it('rejects a contributor submission with optional note', async () => {
    const eventId = await createReviewEvent();
    const rejected = await moderationService.rejectContributorEvent(adminSession, eventId, {
      note: 'Incomplete lineup',
    });

    expect(rejected.status).toBe('rejected');
    expect(auditService.listByEvent(eventId)[0]?.action).toBe('event_rejected');
  });

  it('blocks editors from publishing contributor submissions', async () => {
    const eventId = await createReviewEvent();

    await expect(
      moderationService.approveContributorEvent(editorSession, eventId),
    ).rejects.toThrow(/nicht moderieren/i);
  });

  it('rejects moderation for non-review events', async () => {
    const draft = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'contributor-1',
      linkLabels,
    });

    await expect(
      moderationService.approveContributorEvent(adminSession, draft.id),
    ).rejects.toThrow(/in Prüfung/i);
  });

  it('rejects publish when contributor withdrew before moderation save', async () => {
    const eventId = await createReviewEvent();

    await contributorEventService.withdrawFromReview({
      eventId,
      userId: 'contributor-1',
    });

    await expect(
      moderationService.approveContributorEvent(adminSession, eventId),
    ).rejects.toThrow(/in Prüfung/i);
  });
});
