import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_EVENT_CATALOG,
  CUSTOM_ANALYTICS_EVENTS,
  STANDARD_ANALYTICS_EVENTS,
} from '@/platform/analytics/analytics-events';

describe('analytics-events', () => {
  it('defines standard events without PII in names', () => {
    for (const value of Object.values(STANDARD_ANALYTICS_EVENTS)) {
      expect(value).not.toMatch(/@|email|phone|name/i);
    }
  });

  it('defines custom events without PII in names', () => {
    for (const value of Object.values(CUSTOM_ANALYTICS_EVENTS)) {
      expect(value).not.toMatch(/@|email|phone/i);
    }
  });

  it('marks analytics events as consent required', () => {
    expect(ANALYTICS_EVENT_CATALOG.every((event) => event.consentRequired)).toBe(true);
  });
});
