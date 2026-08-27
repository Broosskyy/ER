import { describe, expect, it } from 'vitest';

import { canonicalizeOfficialSourceUrl } from '../source-identity';

describe('canonicalizeOfficialSourceUrl', () => {
  it('keeps trailing slash for path-based official urls', () => {
    expect(canonicalizeOfficialSourceUrl('https://bootshaus.tv/events/rakkas/')).toBe(
      'https://bootshaus.tv/events/rakkas/',
    );
  });

  it('preserves query-param edition ids for zakk event-detail urls', () => {
    expect(canonicalizeOfficialSourceUrl('https://zakk.de/event-detail?event=16192')).toBe(
      'https://zakk.de/event-detail?event=16192',
    );
    expect(canonicalizeOfficialSourceUrl('https://zakk.de/event-detail?event=16193&event-ics-cmd=1')).toBe(
      'https://zakk.de/event-detail?event=16193',
    );
    expect(canonicalizeOfficialSourceUrl('https://zakk.de/event-detail?event=16192')).not.toBe(
      canonicalizeOfficialSourceUrl('https://zakk.de/event-detail?event=16193'),
    );
  });
});
