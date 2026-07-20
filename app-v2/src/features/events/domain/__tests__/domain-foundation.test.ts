import { describe, expect, it } from 'vitest';

import { mapCurrentStatusToDimensions } from '@/features/events/domain/event-status-dimensions';
import { resolveTicketingMode } from '@/features/events/domain/ticketing-foundation';

describe('event status dimensions foundation', () => {
  it('maps current editorial status without breaking existing values', () => {
    expect(mapCurrentStatusToDimensions('draft')).toEqual({
      editorial: 'draft',
      operational: undefined,
      ticket: undefined,
    });

    expect(mapCurrentStatusToDimensions('published')).toEqual({
      editorial: 'published',
      operational: 'scheduled',
      ticket: undefined,
    });
  });
});

describe('ticketing foundation', () => {
  it('classifies external ticket URLs as external_url mode', () => {
    expect(resolveTicketingMode(null)).toBe('none');
    expect(resolveTicketingMode('https://tickets.example.com/event')).toBe('external_url');
  });
});
