import { describe, expect, it } from 'vitest';

import { isSafeExternalHttpUrl } from '@/platform/linking/external-url';

describe('ticket URL safety', () => {
  it('allows https ticket providers', () => {
    expect(isSafeExternalHttpUrl('https://ra.co/events/123456')).toBe(true);
  });

  it('rejects unsafe schemes', () => {
    expect(isSafeExternalHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalHttpUrl('javascript:void(0)')).toBe(false);
  });
});
