import { describe, expect, it } from 'vitest';

import {
  buildBootshausDetailUrl,
  canonicalizeBootshausUrl,
  extractBootshausDetailSlug,
  isBootshausDetailUrl,
  resolveBootshausRedirectUrl,
} from '../bootshaus/url-policy';

describe('bootshaus url policy', () => {
  it('canonicalizes detail URLs with trailing slash', () => {
    expect(canonicalizeBootshausUrl('http://bootshaus.tv/events/sample-event')).toBe(
      'https://bootshaus.tv/events/sample-event/',
    );
  });

  it('extracts detail slugs only for /events/{slug}/ paths', () => {
    expect(extractBootshausDetailSlug('/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie')).toBe(
      'loonyland-pres-luca-dante-spadafora-2-engel-charlie',
    );
    expect(isBootshausDetailUrl('https://bootshaus.tv/events/')).toBe(false);
    expect(isBootshausDetailUrl('https://bootshaus.tv/tickets/')).toBe(false);
  });

  it('upgrades same-host http redirects to https', () => {
    expect(
      resolveBootshausRedirectUrl(
        'https://bootshaus.tv/events/',
        'http://bootshaus.tv/events/sample-event/',
      ),
    ).toBe('https://bootshaus.tv/events/sample-event/');
  });

  it('rejects external redirects', () => {
    expect(
      resolveBootshausRedirectUrl('https://bootshaus.tv/events/', 'https://ticket.io/event/1'),
    ).toBeNull();
  });

  it('builds canonical detail URLs from slugs', () => {
    expect(buildBootshausDetailUrl('affenkaefig-rules-bootshaus-koeln')).toBe(
      'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln/',
    );
  });
});
