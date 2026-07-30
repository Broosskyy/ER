import { describe, expect, it } from 'vitest';

import {
  inferSourceCategory,
  isSourceCategory,
  SOURCE_CATEGORIES,
} from '@/features/sources/domain/source-categories';

describe('source categories', () => {
  it('includes ticket_platform without removing existing categories', () => {
    expect(SOURCE_CATEGORIES).toContain('ticket_platform');
    expect(SOURCE_CATEGORIES).toContain('ticket_provider');
    expect(SOURCE_CATEGORIES).toContain('website');
  });

  it('recognizes ticket_platform as a valid category', () => {
    expect(isSourceCategory('ticket_platform')).toBe(true);
  });

  it('infers ticket_platform from ticket_platform source type', () => {
    expect(
      inferSourceCategory({
        sourceType: 'ticket_platform',
      }),
    ).toBe('ticket_platform');
  });

  it('preserves explicit ticket_provider category', () => {
    expect(
      inferSourceCategory({
        category: 'ticket_provider',
        sourceType: 'ticket_platform',
      }),
    ).toBe('ticket_provider');
  });
});
