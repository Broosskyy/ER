import { describe, expect, it } from 'vitest';

import {
  APP_SCHEME,
  buildNativeDeepLink,
  buildUniversalLink,
  getAssociatedDomainFromEnv,
  IOS_LINKING_PATHS,
} from '@/platform/linking/app-linking';
import { isSafeExternalHttpUrl } from '@/platform/linking/external-url';

describe('app linking', () => {
  it('builds native deep links for supported routes', () => {
    expect(buildNativeDeepLink(IOS_LINKING_PATHS.event('evt-1'))).toBe(
      `${APP_SCHEME}://event/evt-1`,
    );
    expect(buildNativeDeepLink(IOS_LINKING_PATHS.notifications)).toBe(
      `${APP_SCHEME}://notifications`,
    );
    expect(buildNativeDeepLink(IOS_LINKING_PATHS.collection('techno'))).toBe(
      `${APP_SCHEME}://collection/techno`,
    );
  });

  it('builds universal links from configured origin', () => {
    expect(buildUniversalLink('https://example.com', '/event/1')).toBe('https://example.com/event/1');
  });

  it('normalizes associated domain env values', () => {
    expect(getAssociatedDomainFromEnv('https://eternalrave.app/')).toBe('eternalrave.app');
    expect(getAssociatedDomainFromEnv(undefined)).toBeNull();
  });
});

describe('external URL validation', () => {
  it('accepts https ticket links', () => {
    expect(isSafeExternalHttpUrl('https://tickets.example.com/event-1')).toBe(true);
  });

  it('rejects javascript and custom schemes', () => {
    expect(isSafeExternalHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalHttpUrl('eternal-rave://event/1')).toBe(false);
  });
});
