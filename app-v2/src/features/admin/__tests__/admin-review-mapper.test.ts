import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import {
  buildAdminDashboardMetrics,
  buildDuplicateComparisons,
  mapAdminEventToReviewCard,
  resolveQueueStatusLabel,
} from '@/features/admin/utils/admin-review-mapper';
import { resolveModerationQueueStatus } from '@/features/admin/utils/moderation-status';

function event(status: AdminEventRecord['status']): AdminEventRecord {
  return {
    id: 'event-1',
    title: 'Industrial Rebirth',
    description: 'Test',
    genreId: 'techno',
    cityId: 'koeln',
    startDate: '2026-09-12T21:00:00.000Z',
    status,
    createdBy: 'contributor-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

describe('admin review mapper', () => {
  it('builds dashboard metrics from real counts', () => {
    const metrics = buildAdminDashboardMetrics({
      pending: 2,
      in_review: 1,
      needs_changes: 0,
      approved: 3,
      published: 5,
      rejected: 1,
      archived: 0,
    });

    expect(metrics).toHaveLength(6);
    expect(metrics[0]?.valueLabel).toBe('2');
  });

  it('maps review events to German review cards', () => {
    const review = mapAdminEventToReviewCard(event('review'), {
      cityLabel: 'Köln',
      venueLabel: 'Warehouse',
    });

    expect(review.title).toBe('Industrial Rebirth');
    expect(review.submittedByLabel).toContain('Veranstalter');
  });

  it('resolves needs_changes from moderation state', () => {
    expect(
      resolveModerationQueueStatus(event('rejected'), 'needs_changes'),
    ).toBe('needs_changes');
  });

  it('localizes moderation queue status labels in German', () => {
    expect(resolveQueueStatusLabel('needs_changes')).toBe('Änderungen erforderlich');
    expect(resolveQueueStatusLabel('in_review')).toBe('In Prüfung');
  });

  it('builds duplicate comparison rows', () => {
    const comparisons = buildDuplicateComparisons(event('review'), event('published'));
    expect(comparisons.length).toBeGreaterThan(0);
    expect(comparisons[0]?.fieldLabel).toBe('Titel');
  });
});
