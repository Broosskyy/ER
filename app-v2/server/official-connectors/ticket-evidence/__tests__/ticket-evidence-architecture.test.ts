import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  discoverRejectedTicketCandidates,
  discoverTicketLinksFromHtml,
  selectPrimaryTicketLink,
} from '../discover-ticket-links';
import { defaultTicketProviderRegistry } from '../provider-registry';
import { resolveTicketLink } from '../resolve-ticket-link';
import { parseTicketIoPage } from '../parse-ticket-io-page';
import { verifyTicketIdentity } from '../ticket-identity-verify';
import { classifyTicketOfferRole, isAdmissionOfferRole } from '../ticket-offer-role';
import { projectTicketStatusBadge } from '../ticket-status-badge';
import {
  canonicalizeTicketIoUrl,
  classifyProviderKey,
  isTicketIoEventDetailUrl,
} from '../url-policy';

const FIXTURE_DIR = join(__dirname, 'fixtures');
const CACHE_DIR = join(__dirname, '../../../../.tmp/m3-bootshaus-cache/details');

describe('provider-neutral ticket link discovery', () => {
  it('discovers fourvenues and paylogic links from cached bootshaus pages', () => {
    const fourvenuesHtml = readFileSync(
      join(CACHE_DIR, '122-pres-kaz-james-at-palma-de-mallorca-es.html'),
      'utf8',
    );
    const links = discoverTicketLinksFromHtml(
      fourvenuesHtml,
      'https://bootshaus.tv/events/122-pres-kaz-james-at-palma-de-mallorca-es',
      '2026-08-15T12:00:00.000Z',
    );
    const primary = selectPrimaryTicketLink(links);
    expect(primary?.rawUrl).toContain('fourvenues.com');

    const paylogicHtml = readFileSync(join(CACHE_DIR, 'sa-22-08-2026-kitkatclub.html'), 'utf8');
    const paylogicLinks = discoverTicketLinksFromHtml(
      paylogicHtml,
      'https://bootshaus.tv/events/sa-22-08-2026-kitkatclub',
      '2026-08-15T12:00:00.000Z',
    );
    expect(selectPrimaryTicketLink(paylogicLinks)?.rawUrl).toContain('paylogic.com');
  });

  it('discovers ticket.io links without href*=ticket filter', () => {
    const html = `<html><body><a href="https://bootshaus-club.ticket.io/AbCdEf12/" class="button secondary fluid">Tickets</a></body></html>`;
    const links = discoverTicketLinksFromHtml(html, 'https://bootshaus.tv/events/test', '2026-08-15T12:00:00.000Z');
    expect(selectPrimaryTicketLink(links)?.rawUrl).toBe('https://bootshaus-club.ticket.io/AbCdEf12/');
  });
});

describe('provider registry', () => {
  it('routes ticket.io, paylogic and fourvenues urls', () => {
    expect(defaultTicketProviderRegistry.resolveProvider(new URL('https://bootshaus-club.ticket.io/AbCdEf12/')).providerKey).toBe('ticket_io');
    expect(defaultTicketProviderRegistry.resolveProvider(new URL('https://shop.paylogic.com/eda00032b76a4f6c946c688c80a03cf7')).providerKey).toBe('paylogic');
    expect(
      defaultTicketProviderRegistry.resolveProvider(
        new URL('https://site.fourvenues.com/en/bootshaus/events/test-event'),
      ).providerKey,
    ).toBe('fourvenues');
  });

  it('classifies redirectors separately from organizer shops', () => {
    expect(classifyProviderKey('https://bit.ly/ZAAGSTEP')).toBe('redirector');
    expect(classifyProviderKey('https://arep.co/m/ely-oaks')).toBe('organizer_shop');
  });

  it('rejects merchandise links as ticket candidates', () => {
    const html = readFileSync(join(CACHE_DIR, 'mi-30-12-2026-kitkatclub.html'), 'utf8');
    const rejected = discoverRejectedTicketCandidates(
      html,
      'https://bootshaus.tv/events/mi-30-12-2026-kitkatclub',
    );
    expect(rejected.some((entry) => entry.url.includes('snash.com') && entry.reason === 'merchandise_link_rejected')).toBe(
      true,
    );
  });

  it('routes ticket kings urls through registry', () => {
    expect(
      defaultTicketProviderRegistry.resolveProvider(new URL('https://tickets.ticketkings.com/events/bootshaus-test'))
        .providerKey,
    ).toBe('ticket_kings');
  });
});

describe('ticket identity validation', () => {
  it('verifies matching provider identity without title-only merge', () => {
    const result = verifyTicketIdentity({
      providerEventId: 'tA3dBrv7',
      shopHost: 'bootshaus-club.ticket.io',
      providerTitle: 'Bootshaus NYE',
      providerStartAt: '2026-12-31T22:00:00.000Z',
      providerVenue: 'Bootshaus',
      officialTitle: 'Bootshaus & Loonyland pres. NYE 2026',
      officialStartAt: '2026-12-31T22:00:00.000Z',
      officialVenue: 'Bootshaus',
      officialTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      canonicalTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
    });
    expect(result.result).toBe('ticket_identity_verified');
  });

  it('rejects date mismatch for same series title', () => {
    const result = verifyTicketIdentity({
      providerEventId: 'abc123',
      shopHost: 'bootshaus-club.ticket.io',
      providerTitle: 'Bootshaus Weekly',
      providerStartAt: '2026-09-01T22:00:00.000Z',
      providerVenue: 'Bootshaus',
      officialTitle: 'Bootshaus Weekly',
      officialStartAt: '2026-10-01T22:00:00.000Z',
      officialVenue: 'Bootshaus',
      canonicalTicketUrl: 'https://bootshaus-club.ticket.io/abc123/',
    });
    expect(result.result).toBe('ticket_identity_conflict');
  });
});

describe('admission offer roles', () => {
  it('keeps locker offers out of admission projection', () => {
    expect(classifyTicketOfferRole('Locker large')).toBe('locker');
    expect(isAdmissionOfferRole('locker')).toBe(false);
    expect(projectTicketStatusBadge('available')).toBe('Tickets verfügbar');
  });
});

describe('ticket.io detail parser contract', () => {
  it('parses fixture embedded json offers', () => {
    const html = readFileSync(join(FIXTURE_DIR, 'ticket-io-available.html'), 'utf8');
    const evidence = parseTicketIoPage({
      sourceUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      body: html,
      fingerprint: 'fixture',
      observedAt: '2026-08-15T12:00:00.000Z',
      extractedAt: '2026-08-15T12:00:01.000Z',
    });
    expect(evidence?.normalizedStatus).toBe('available');
    expect(evidence?.offers[0]?.amountMinor).toBe(1990);
  });
});

describe('url policy', () => {
  it('canonicalizes ticket.io detail urls', () => {
    const url = 'https://bootshaus-club.ticket.io/tA3dBrv7/?utm_source=test';
    expect(canonicalizeTicketIoUrl(url)).toBe('https://bootshaus-club.ticket.io/tA3dBrv7/');
    expect(isTicketIoEventDetailUrl(url)).toBe(true);
  });
});
