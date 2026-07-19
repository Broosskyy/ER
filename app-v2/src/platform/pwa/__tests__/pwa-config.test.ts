import { describe, expect, it } from 'vitest';

import { PWA_CONFIG, WEB_PAGE_TITLES } from '@/platform/pwa/pwa-config';

describe('PWA config', () => {
  it('defines required manifest fields', () => {
    expect(PWA_CONFIG.name).toBe('Eternal Rave');
    expect(PWA_CONFIG.shortName).toBeTruthy();
    expect(PWA_CONFIG.startUrl).toBe('/');
    expect(PWA_CONFIG.scope).toBe('/');
    expect(PWA_CONFIG.themeColor).toMatch(/^#/);
    expect(PWA_CONFIG.backgroundColor).toMatch(/^#/);
    expect(PWA_CONFIG.manifestPath).toBe('/manifest.webmanifest');
  });

  it('defines route titles for key screens', () => {
    expect(WEB_PAGE_TITLES.home).toContain('Eternal Rave');
    expect(WEB_PAGE_TITLES.notifications).toContain('Notifications');
    expect(WEB_PAGE_TITLES.adminLogin).toContain('Admin');
  });
});
