import { describe, expect, it } from 'vitest';

import { buildDeduplicationKey } from '../services/notification-deduplication';

describe('notification deduplication', () => {
  it('builds stable keys with event, type and version', () => {
    expect(
      buildDeduplicationKey({
        eventId: 'event-1',
        type: 'saved_event_updated',
        version: '2026-05-24T10:00:00.000Z',
      }),
    ).toBe('event-1:saved_event_updated:2026-05-24T10:00:00.000Z');
  });

  it('uses general fallback when event id is missing', () => {
    expect(
      buildDeduplicationKey({
        type: 'general',
      }),
    ).toBe('general:general:v1');
  });
});
