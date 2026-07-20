import { describe, expect, it } from 'vitest';

import {
  canContributorTransition,
  CONTRIBUTOR_ALLOWED_TRANSITIONS,
} from '@/features/create/constants/contributor-event-status';

describe('contributor event status transitions', () => {
  it('allows draft to review and review to draft only', () => {
    expect(canContributorTransition('draft', 'review')).toBe(true);
    expect(canContributorTransition('review', 'draft')).toBe(true);
    expect(canContributorTransition('draft', 'published')).toBe(false);
    expect(canContributorTransition('review', 'published')).toBe(false);
    expect(canContributorTransition('published', 'draft')).toBe(false);
  });

  it('does not expose pending_review or other legacy values', () => {
    const statuses = Object.keys(CONTRIBUTOR_ALLOWED_TRANSITIONS);
    expect(statuses).toEqual(['draft', 'review', 'published', 'rejected', 'archived']);
    expect(statuses).not.toContain('pending_review');
  });
});
