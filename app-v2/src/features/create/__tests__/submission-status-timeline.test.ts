import { describe, expect, it } from 'vitest';

import {
  buildSubmissionTimelineSteps,
  resolveSubmissionDisplayStatus,
  resolveSubmissionTimelineLabel,
} from '@/features/create/wizard/submission-status-timeline';
import type { EventSubmission } from '@/features/create/wizard/wizard-types';
import type { AdminEventRecord } from '@/data/types/records';

function submission(status: EventSubmission['status']): EventSubmission {
  return {
    id: 'submission-1',
    eventId: 'event-1',
    draftId: 'draft-1',
    organizerId: 'org-1',
    status,
    submittedAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
    eventSnapshot: { title: 'Test Event' },
    history: [
      { status: 'draft', at: '2026-01-01T00:00:00.000Z' },
      { status, at: '2026-01-03T00:00:00.000Z' },
    ],
  };
}

function adminEvent(status: AdminEventRecord['status']): AdminEventRecord {
  return {
    id: 'event-1',
    title: 'Test Event',
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

describe('submission status timeline', () => {
  it('labels timeline steps in German', () => {
    expect(resolveSubmissionTimelineLabel('pending')).toBe('Eingereicht');
    expect(resolveSubmissionTimelineLabel('needs_changes')).toBe('Änderungen erforderlich');
  });

  it('marks the active step for pending submissions', () => {
    const steps = buildSubmissionTimelineSteps('pending');
    expect(steps.find((step) => step.id === 'pending')?.state).toBe('active');
    expect(steps.find((step) => step.id === 'draft')?.state).toBe('completed');
  });

  it('maps rejected admin events to needs_changes display status', () => {
    expect(resolveSubmissionDisplayStatus(submission('pending'), adminEvent('rejected'))).toBe(
      'needs_changes',
    );
  });

  it('maps published admin events to published display status', () => {
    expect(resolveSubmissionDisplayStatus(submission('pending'), adminEvent('published'))).toBe(
      'published',
    );
  });
});
