import { describe, expect, it } from 'vitest';

import {
  ADMIN_EDITORIAL_TRANSITIONS,
  ADMIN_MODERATION_TRANSITIONS,
  assertValidAdminEditorialTransition,
  canAdminEditorialTransition,
  canAdminModerateTransition,
  isContributorReviewEvent,
  isContributorSubmission,
} from '@/features/admin/constants/admin-event-status';

describe('admin event status transitions', () => {
  it('allows moderation only from review to published or rejected', () => {
    expect(canAdminModerateTransition('review', 'published')).toBe(true);
    expect(canAdminModerateTransition('review', 'rejected')).toBe(true);
    expect(canAdminModerateTransition('review', 'draft')).toBe(false);
    expect(canAdminModerateTransition('draft', 'published')).toBe(false);
  });

  it('defines editorial transitions for CMS workflows', () => {
    expect(canAdminEditorialTransition('draft', 'published')).toBe(true);
    expect(canAdminEditorialTransition('published', 'archived')).toBe(true);
    expect(canAdminEditorialTransition('archived', 'draft')).toBe(false);
  });

  it('covers all lifecycle statuses in editorial map', () => {
    expect(Object.keys(ADMIN_EDITORIAL_TRANSITIONS)).toEqual([
      'draft',
      'review',
      'published',
      'rejected',
      'archived',
    ]);
    expect(ADMIN_MODERATION_TRANSITIONS.review).toEqual(['published', 'rejected']);
  });

  it('detects contributor submissions via createdBy', () => {
    expect(isContributorSubmission({ createdBy: 'user-1' })).toBe(true);
    expect(isContributorSubmission({ createdBy: '' })).toBe(false);
    expect(isContributorSubmission({})).toBe(false);
  });

  it('detects contributor review events', () => {
    expect(isContributorReviewEvent({ status: 'review', createdBy: 'user-1' })).toBe(true);
    expect(isContributorReviewEvent({ status: 'draft', createdBy: 'user-1' })).toBe(false);
    expect(isContributorReviewEvent({ status: 'review' })).toBe(false);
  });

  it('rejects illegal editorial transitions via assertValidAdminEditorialTransition', () => {
    expect(() => assertValidAdminEditorialTransition('archived', 'draft')).toThrow(
      /invalid status transition/i,
    );
    expect(() => assertValidAdminEditorialTransition('draft', 'published')).not.toThrow();
  });
});
