import { beforeEach, describe, expect, it } from 'vitest';

import { getLocalStore } from '@/data/datasources/local/local-datasource';
import { AdminEventRepository } from '@/data/repositories/repositories';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import { AdminEventModerationService } from '@/features/admin/services/admin-event-moderation-service';
import { AdminModerationStateService } from '@/features/admin/services/admin-moderation-state-service';
import { EventModerationAuditService } from '@/features/admin/services/event-moderation-audit-service';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';
import { fieldTrustMergeService } from '@/features/import/services/field-trust-merge-service';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import type { AuthSession } from '@/services/supabase/auth-service';

const linkLabels = { website: 'Website', instagram: 'Instagram', facebook: 'Facebook' };

const baseForm: EventDraftFormValues = {
  title: 'Moderation Provenance Target',
  startDate: '2026-09-12',
  startTime: '23:00',
  endDate: '',
  endTime: '',
  venueId: '',
  venueText: 'Warehouse',
  genreId: 'techno',
  description: 'Contributor approved description.',
  ticketUrl: 'https://tickets.example/event',
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

describe('moderation publish provenance', () => {
  let moderationService: AdminEventModerationService;
  let multiSource: InMemoryMultiSourceRepositories;

  beforeEach(() => {
    const store = getLocalStore();
    store.adminEvents = store.adminEvents.filter((event) => !event.id.startsWith('draft-'));
    multiSource = new InMemoryMultiSourceRepositories();
    moderationService = new AdminEventModerationService(
      new AdminEventRepository(),
      new EventModerationAuditService(),
      new AdminModerationStateService(),
      new EventFieldProvenanceWriter(multiSource.fieldProvenance),
    );
  });

  async function publishContributorEvent(): Promise<string> {
    const draft = await contributorEventService.createEvent({
      form: baseForm,
      userId: 'contributor-1',
      linkLabels,
    });
    const submitted = await contributorEventService.submitForReview({
      eventId: draft.id,
      userId: 'contributor-1',
    });
    await moderationService.approveContributorEvent(adminSession, submitted.id);
    const published = await moderationService.publishContributorEvent(adminSession, submitted.id);
    return published.id;
  }

  it('writes manual_override provenance for moderated publish fields', async () => {
    const eventId = await publishContributorEvent();
    const description = await multiSource.fieldProvenance.findByFieldPath(eventId, 'description');
    const ticketUrl = await multiSource.fieldProvenance.findByFieldPath(eventId, 'ticketUrl');

    expect(description?.selectedSourceId).toBe('manual_override');
    expect(description?.selectionReason).toContain('moderation_publish_approved');
    expect(ticketUrl?.selectedSourceId).toBe('manual_override');
  });

  it('prevents later lower-trust import from overwriting moderated description', async () => {
    const eventId = await publishContributorEvent();
    const existing = await new AdminEventRepository().getById(eventId);
    expect(existing).toBeTruthy();

    const provenanceByField = await new EventFieldProvenanceWriter(
      multiSource.fieldProvenance,
    ).loadProvenanceByField(eventId);

    const merge = fieldTrustMergeService.mergeAdminEvent({
      existing: existing!,
      candidate: {
        title: existing!.title,
        startDate: existing!.startDate,
        sourceId: 'source-aggregator',
        sourceName: 'Aggregator',
        externalId: 'agg-1',
        description: 'Automated overwrite attempt',
      },
      source: {
        id: 'source-aggregator',
        slug: 'aggregator',
        stableKey: 'aggregator',
        displayName: 'Aggregator',
        sourceType: 'website',
        parserType: 'unknown',
        acquisitionStrategy: 'manual',
        status: 'active',
        enabled: true,
        archived: false,
        reviewRequired: false,
        priority: 10,
        trustScore: 10,
        requiresAuthentication: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      behavior: 'auto_publish',
      provenanceByField,
    });

    expect(merge.event.description).toBe(existing!.description);
    expect(merge.decisions.some((entry) => entry.field === 'description' && entry.decision === 'skipped_locked')).toBe(
      true,
    );
  });
});
