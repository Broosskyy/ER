import { describe, expect, it } from 'vitest';

import {
  artistProfileRoute,
  organizerProfileRoute,
  resolveEntityProfileRoute,
  venueProfileRoute,
} from '@/features/profiles/routes/entity-profile-routes';

describe('entity profile routes', () => {
  it('builds singular Expo routes', () => {
    expect(artistProfileRoute('westbam')).toBe('/artist/westbam');
    expect(venueProfileRoute('bootshaus')).toBe('/venue/bootshaus');
    expect(organizerProfileRoute('lehmann')).toBe('/organizer/lehmann');
  });

  it('resolves canonical routes from typed entities', () => {
    expect(resolveEntityProfileRoute('ARTIST', 'westbam')).toBe('/artist/westbam');
    expect(resolveEntityProfileRoute('venue', 'bootshaus')).toBe('/venue/bootshaus');
    expect(resolveEntityProfileRoute('ORGANIZER', 'lehmann')).toBe('/organizer/lehmann');
  });

  it('rejects empty ids and unknown types', () => {
    expect(resolveEntityProfileRoute('artist', '  ')).toBeUndefined();
    expect(resolveEntityProfileRoute('festival', 'tomorrowland')).toBeUndefined();
  });
});
