import { describe, expect, it } from 'vitest';

import {
  ADMIN_DASHBOARD_ROUTE,
  ADMIN_REVIEW_QUEUE_ROUTE,
  ADMIN_SOURCES_ROUTE,
  buildAdminDuplicateReviewRoute,
  buildAdminReviewDetailRoute,
  buildAdminReviewQueueFilterRoute,
} from '@/features/admin/constants/admin-review-routes';

describe('admin navigation routes', () => {
  it('links dashboard to pending review queue', () => {
    expect(ADMIN_DASHBOARD_ROUTE).toBe('/admin');
    expect(buildAdminReviewQueueFilterRoute('pending')).toBe('/admin/events/review?filter=pending');
  });

  it('builds review detail and duplicate routes from event ids', () => {
    expect(buildAdminReviewDetailRoute('event-abc')).toBe('/admin/events/review/event-abc');
    expect(buildAdminDuplicateReviewRoute('event-abc')).toBe(
      '/admin/events/review/event-abc/duplicates',
    );
  });

  it('exposes sources route for dashboard navigation', () => {
    expect(ADMIN_SOURCES_ROUTE).toBe('/admin/sources');
    expect(ADMIN_REVIEW_QUEUE_ROUTE).toBe('/admin/events/review');
  });
});
