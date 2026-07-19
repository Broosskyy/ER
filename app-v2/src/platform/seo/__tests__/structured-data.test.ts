import { describe, expect, it } from 'vitest';

import { buildEventJsonLd, buildOrganizationJsonLd } from '@/platform/seo/structured-data';

describe('structured-data', () => {
  it('builds organization JSON-LD', () => {
    const data = buildOrganizationJsonLd();
    expect(data['@type']).toBe('Organization');
    expect(data.name).toBe('Eternal Rave');
  });

  it('builds event JSON-LD with required fields', () => {
    const data = buildEventJsonLd({
      id: 'evt-1',
      title: 'Test Rave',
      startDate: '2026-08-01T22:00:00+02:00',
      venueName: 'Club',
      city: 'Köln',
    });
    expect(data['@type']).toBe('Event');
    expect(data.name).toBe('Test Rave');
    expect(data.startDate).toBe('2026-08-01T22:00:00+02:00');
  });
});
