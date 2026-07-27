import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { EventSubmission } from '@/features/create/wizard/wizard-types';
import {
  filterMyEventsByStatus,
  indexSubmissionsByEventId,
  MY_EVENTS_FILTER_OPTIONS,
  resolveMyEventCategory,
} from '@/features/my-events/utils/my-events-filters';

function event(status: AdminEventRecord['status'], id: string): AdminEventRecord {
  return {
    id,
    title: id,
    description: '',
    genreId: 'techno',
    cityId: 'koeln',
    startDate: '2026-09-12T21:00:00.000Z',
    status,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

function submission(eventId: string, status: EventSubmission['status']): EventSubmission {
  return {
    id: `submission-${eventId}`,
    eventId,
    draftId: `draft-${eventId}`,
    organizerId: 'org-1',
    status,
    submittedAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
    eventSnapshot: {},
    history: [],
  };
}

describe('my events filters', () => {
  const events = [
    event('draft', 'draft-1'),
    event('review', 'submitted-1'),
    event('review', 'review-1'),
    event('published', 'published-1'),
    event('rejected', 'rejected-1'),
    event('archived', 'archived-1'),
  ];

  const submissionsByEventId = indexSubmissionsByEventId([
    submission('submitted-1', 'pending'),
    submission('review-1', 'in_review'),
  ]);

  it('exposes the sprint filter options', () => {
    expect(MY_EVENTS_FILTER_OPTIONS).toEqual([
      'all',
      'draft',
      'submitted',
      'in_review',
      'needs_changes',
      'published',
      'archived',
    ]);
  });

  it('returns all events for the all filter', () => {
    expect(filterMyEventsByStatus(events, 'all', submissionsByEventId)).toHaveLength(6);
  });

  it('filters by lifecycle category', () => {
    expect(
      filterMyEventsByStatus(events, 'draft', submissionsByEventId).map((entry) => entry.id),
    ).toEqual(['draft-1']);
    expect(
      filterMyEventsByStatus(events, 'submitted', submissionsByEventId).map((entry) => entry.id),
    ).toEqual(['submitted-1']);
    expect(
      filterMyEventsByStatus(events, 'in_review', submissionsByEventId).map((entry) => entry.id),
    ).toEqual(['review-1']);
    expect(
      filterMyEventsByStatus(events, 'needs_changes', submissionsByEventId).map((entry) => entry.id),
    ).toEqual(['rejected-1']);
    expect(
      filterMyEventsByStatus(events, 'published', submissionsByEventId).map((entry) => entry.id),
    ).toEqual(['published-1']);
    expect(
      filterMyEventsByStatus(events, 'archived', submissionsByEventId).map((entry) => entry.id),
    ).toEqual(['archived-1']);
  });

  it('resolves review events without submission as submitted', () => {
    expect(resolveMyEventCategory(event('review', 'legacy-review'))).toBe('submitted');
  });
});
