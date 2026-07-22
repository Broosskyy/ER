import { describe, expect, it } from 'vitest';

import {
  CREATE_HUB_RETURN_ROUTE,
  CREATE_OPTIONS,
  getVisibleCreateOptions,
  getCreateOptionTargetHref,
  shouldPromptCreateAuth,
} from '@/features/create/create-hub-config';
import { buildLoginHref, buildRegisterHref, getCreateAuthLinks } from '@/features/auth/auth-route-utils';

describe('create hub config', () => {
  it('lists all create hub options', () => {
    expect(CREATE_OPTIONS.map((option) => option.id)).toEqual([
      'event',
      'organizer',
      'venue',
      'artist',
      'account',
    ]);
  });

  it('shows only closed-beta-ready options in the create hub', () => {
    expect(getVisibleCreateOptions().map((option) => option.id)).toEqual(['event', 'account']);
  });

  it('prompts auth for contribution options when logged out', () => {
    expect(shouldPromptCreateAuth('event', false)).toBe(true);
    expect(shouldPromptCreateAuth('account', false)).toBe(false);
  });

  it('routes logged-out account creation directly to register with safe returnTo', () => {
    expect(getCreateOptionTargetHref('account', false)).toBe(
      '/register?returnTo=%2Fcreate',
    );
  });

  it('routes logged-in contribution options to placeholder routes', () => {
    expect(getCreateOptionTargetHref('event', true)).toBe('/create/event');
    expect(getCreateOptionTargetHref('artist', true)).toBe('/create/artist');
  });

  it('exposes a future edit route convention', async () => {
    const {
      getContributorEventEditRoute,
      getContributorEventPreviewRoute,
    } = await import('@/features/create/constants/contributor-event-routes');
    expect(getContributorEventEditRoute('draft-123')).toBe('/event/draft-123/edit');
    expect(getContributorEventPreviewRoute('draft-123')).toBe('/event/draft-123/preview');
  });

  it('exposes create auth links with safe returnTo', () => {
    expect(getCreateAuthLinks()).toEqual({
      loginHref: buildLoginHref(CREATE_HUB_RETURN_ROUTE),
      registerHref: buildRegisterHref(CREATE_HUB_RETURN_ROUTE),
    });
  });
});
