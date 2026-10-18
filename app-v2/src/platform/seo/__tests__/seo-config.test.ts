import { describe, expect, it } from 'vitest';

import {
  buildCanonicalUrl,
  DEFAULT_WEB_BASE_URL,
  getWebBaseUrl,
  isGlobalNoIndex,
  resolveOgImageUrl,
} from '@/platform/seo/seo-config';

describe('seo-config', () => {
  it('uses production canonical URLs without a configured web base', () => {
    const previous = process.env.EXPO_PUBLIC_WEB_BASE_URL;
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
    expect(getWebBaseUrl()).toBe(DEFAULT_WEB_BASE_URL);
    expect(buildCanonicalUrl('/search')).toBe('https://eternal-rave.vercel.app/search');
    if (previous === undefined) delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
    else process.env.EXPO_PUBLIC_WEB_BASE_URL = previous;
  });

  it('builds canonical URLs from base env', () => {
    const previous = process.env.EXPO_PUBLIC_WEB_BASE_URL;
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://www.example.com/';
    expect(buildCanonicalUrl('/search')).toBe('https://www.example.com/search');
    process.env.EXPO_PUBLIC_WEB_BASE_URL = previous;
  });

  it('resolves absolute OG image URLs when base is set', () => {
    const previous = process.env.EXPO_PUBLIC_WEB_BASE_URL;
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://www.example.com';
    expect(resolveOgImageUrl('/pwa/icon-512.png')).toBe('https://www.example.com/pwa/icon-512.png');
    process.env.EXPO_PUBLIC_WEB_BASE_URL = previous;
  });

  it('detects global noindex flag', () => {
    const previous = process.env.EXPO_PUBLIC_WEB_NOINDEX;
    process.env.EXPO_PUBLIC_WEB_NOINDEX = 'true';
    expect(isGlobalNoIndex()).toBe(true);
    process.env.EXPO_PUBLIC_WEB_NOINDEX = previous;
  });
});
