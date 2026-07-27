import { describe, expect, it } from 'vitest';

import { buildEventSubmissionStatusRoute, PROFILE_MY_EVENTS_ROUTE, PROFILE_ORGANIZER_ROUTE } from '@/features/create/constants/contributor-event-routes';

describe('organizer navigation routes', () => {
  it('links organizer profile to my events', () => {
    expect(PROFILE_ORGANIZER_ROUTE).toBe('/profile/organizer');
    expect(PROFILE_MY_EVENTS_ROUTE).toBe('/profile/events');
  });

  it('builds submission status routes from event or submission ids', () => {
    expect(buildEventSubmissionStatusRoute('submission-abc')).toBe('/create/event/status/submission-abc');
    expect(buildEventSubmissionStatusRoute('event-abc')).toBe('/create/event/status/event-abc');
  });
});
