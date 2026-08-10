import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { DetailEvidenceService } from '@/features/import/clean-import-core/detail-evidence-service';
import { parseDetailEvidenceFromHtml } from '@/features/import/clean-import-core/detail-evidence-parser';
import type { ConnectorOutput } from '@/features/import/clean-import-core/event-evidence';
import { evaluateSourceNativeIdentityCompatibility } from '@/features/import/clean-import-core/identity-resolver';
import { ImportRunner } from '@/features/import/clean-import-core/import-runner';
import { resolveMissingLiveEvidenceDisposition } from '@/features/import/clean-import-core/review-decision';
import { SourceAdapter } from '@/features/import/clean-import-core/source-adapter';
import { ImportFetchService } from '@/features/import/services/import-fetch-service';

import { REFERENCE_FIXTURES } from './fixtures/reference-fixtures';

const VERIFIED_AT = '2026-08-10T18:00:00.000Z';
const TICKET_FIXTURE_DIR = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures',
);

function fixture(name: string): ConnectorOutput[] {
  return REFERENCE_FIXTURES.find((entry) => entry.name === name)!.outputs.map(
    (output) => ({ ...output }),
  );
}

describe('minimal clean import vertical slice', () => {
  it('merges official and ticket contributions with separate URL roles', () => {
    const result = new ImportRunner().run(fixture('LEVI'));

    expect(result.decision).toBe('publish_partial');
    expect(result.canonicalEvent?.title).toBe('Nights With Us presents LEVI');
    expect(result.canonicalEvent?.websiteUrl).toBe(
      'https://official.example/events/levi',
    );
    expect(result.canonicalEvent?.ticketUrl).toBe(
      'https://reference.ticket.io/levi/',
    );
  });

  it('does not create identity from a Ticket.io PoW page and caches the result', async () => {
    const html = readFileSync(
      join(TICKET_FIXTURE_DIR, 'ticket-io-proton-shockone-detail.html'),
      'utf8',
    );
    const url = 'https://reference.ticket.io/pow/';
    const service = new DetailEvidenceService({
      embeddedHtmlByUrl: new Map([[url, html]]),
    });
    const request = {
      sourceId: 'ticket-io-pow',
      sourceFamily: 'ticket_io' as const,
      sourceUrl: url,
      verifiedAt: VERIFIED_AT,
    };

    const first = await service.resolve(request);
    const second = await service.resolve(request);

    expect(first.title).toBeUndefined();
    expect(first.diagnostics).toContain('identity_blocked:pow_without_list_card');
    expect(second.title).toBeUndefined();
    expect(service.getCacheHits()).toBe(1);
  });

  it('accepts safe Ticket.io list-card identity and admission fields when detail is PoW', () => {
    const html = readFileSync(
      join(TICKET_FIXTURE_DIR, 'ticket-io-proton-shockone-detail.html'),
      'utf8',
    );
    const output = parseDetailEvidenceFromHtml({
      sourceId: 'ticket-io-list-card',
      sourceFamily: 'ticket_io',
      sourceUrl: 'https://reference.ticket.io/list-card/',
      verifiedAt: VERIFIED_AT,
      html,
      listCard: {
        title: 'List Card Event',
        eventDate: '2026-09-10T22:00:00+02:00',
        venueName: 'Reference Club',
        priceText: '25,00 €',
        publicTicketUrl: 'https://reference.ticket.io/list-card/',
      },
    });

    expect(output.title).toBe('List Card Event');
    expect(output.admissionPrice?.amount).toBe(25);
    expect(output.publicTicketUrl).toBe(
      'https://reference.ticket.io/list-card/',
    );
    const evidence = new SourceAdapter().adapt(output);
    expect(evidence.tickets.admissionProducts?.value).toHaveLength(1);
    expect(evidence.tickets.ticketStatus?.value).toBe('on_sale');
  });

  it('keeps TicketKings public CTA separate from checkout evidence', () => {
    const detailHtml = readFileSync(
      join(TICKET_FIXTURE_DIR, 'ticket-kings-event-detail.html'),
      'utf8',
    );
    const checkoutHtml = readFileSync(
      join(TICKET_FIXTURE_DIR, 'ticket-kings-admission-flex-checkout.html'),
      'utf8',
    );
    const output = parseDetailEvidenceFromHtml({
      sourceId: 'ticket-kings-detail',
      sourceFamily: 'ticket_kings',
      sourceUrl: 'https://ticketkings.de/event/public-event/',
      verifiedAt: VERIFIED_AT,
      html: detailHtml,
      checkoutHtml,
      identity: {
        title: 'Public Event',
        startDate: '2026-08-15T22:00:00+02:00',
        venueName: 'Reference Club',
      },
    });

    expect(output.publicTicketUrl).toBe(
      'https://ticketkings.de/event/public-event/',
    );
    expect(output.checkoutEvidenceUrl).toMatch(/nacht-manager\.de/);
    expect(output.checkoutEvidenceUrl).not.toBe(output.publicTicketUrl);
  });

  it('does not count optional TicketKings Flex as admission', () => {
    const checkoutHtml = readFileSync(
      join(TICKET_FIXTURE_DIR, 'ticket-kings-admission-flex-checkout.html'),
      'utf8',
    );
    const output = parseDetailEvidenceFromHtml({
      sourceId: 'ticket-kings-price',
      sourceFamily: 'ticket_kings',
      sourceUrl: 'https://ticketkings.de/event/price-event/',
      verifiedAt: VERIFIED_AT,
      html: '<iframe src="https://nacht-manager.de/ticketing/native_event.php?id=123"></iframe>',
      checkoutHtml,
      identity: {
        title: 'Price Event',
        startDate: '2026-08-15T22:00:00+02:00',
        venueName: 'Reference Club',
      },
    });

    expect(output.admissionPrice?.amount).toBe(15);
    expect(output.diagnostics).toContain(
      'excluded_add_on:Ticket Flex Option',
    );
    const evidence = new SourceAdapter().adapt(output);
    expect(evidence.tickets.admissionProducts?.value[0]?.priceAmount).toBe(15);
    expect(evidence.tickets.excludedProducts?.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ticket Flex Option' }),
      ]),
    );
  });

  it('follows a relative 301 redirect and preserves requested and final URLs', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('', {
          status: 301,
          headers: { location: '/events/final/' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<title>Final Event</title>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const response = await new ImportFetchService().fetch({
        url: 'https://official.example/events/original',
        allowedContentTypes: ['text/html'],
      });
      expect(response.requestedUrl).toBe(
        'https://official.example/events/original',
      );
      expect(response.url).toBe('https://official.example/events/final/');
      expect(response.redirectChain).toEqual([
        'https://official.example/events/original',
        'https://official.example/events/final/',
      ]);
      expect(response.body).toContain('Final Event');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks a redirect loop', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      return url.endsWith('/events/a')
        ? new Response('', {
            status: 302,
            headers: { location: '/events/b' },
          })
        : new Response('', {
            status: 308,
            headers: { location: '/events/a' },
          });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(
        new ImportFetchService().fetch({
          url: 'https://official.example/events/a',
          allowedContentTypes: ['text/html'],
        }),
      ).rejects.toThrow('Redirect loop detected');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('never adapts a redirect placeholder body as event content', () => {
    const evidence = new SourceAdapter().adapt({
      sourceId: 'redirect-official',
      sourceFamily: 'official_website',
      sourceUrl: 'https://official.example/events/redirected',
      requestedSourceUrl: 'https://official.example/events/redirected',
      finalSourceUrl: 'https://official.example/events/redirected/',
      verifiedAt: VERIFIED_AT,
      title: '301 Moved Permanently',
      description: '<h1>301 Moved Permanently</h1>',
      lineupState: 'explicit_artists',
      lineup: [
        {
          sortOrder: 0,
          displayName: '301 Moved Permanently',
          rawSourceSpelling: '301 Moved Permanently',
          normalizedName: '301 moved permanently',
          billingRelation: 'SOLO',
          isB2b: false,
          isF2f: false,
          isLiveSet: false,
          confidence: 0.1,
          reviewState: 'accepted',
          inclusionReason: 'redirect_body',
        },
      ],
      officialWebsiteUrl: 'https://official.example/events/redirected/',
    });
    expect(evidence.identity.title).toBeUndefined();
    expect(evidence.content.description).toBeUndefined();
    expect(evidence.content.lineup).toBeUndefined();
    expect(evidence.requestedSourceUrl).toContain('/redirected');
    expect(evidence.finalSourceUrl).toContain('/redirected/');
    expect(evidence.diagnostics).toContain(
      'redirect_placeholder_content_rejected',
    );
  });

  it('never replaces the official website with a ticket URL', () => {
    const outputs = fixture('BC173');
    outputs[1] = {
      ...outputs[1]!,
      officialWebsiteUrl: 'https://ticket.example/not-official',
    };
    const result = new ImportRunner().run(outputs);

    expect(result.canonicalEvent?.websiteUrl).toBe(
      'https://official.example/events/bc173',
    );
  });

  it('preserves a structured lineup block', () => {
    const result = new ImportRunner().run(
      fixture('Sommerfest Elektroküche'),
    );

    expect(result.canonicalEvent?.lineup?.map((entry) => entry.displayName)).toEqual([
      'DJ Alpha',
      'DJ Beta',
    ]);
  });

  it('keeps TBA as an empty lineup with its evidence reason', () => {
    const official: ConnectorOutput = {
      sourceId: 'tba-official',
      sourceFamily: 'official_website',
      sourceUrl: 'https://official.example/events/tba',
      verifiedAt: VERIFIED_AT,
      title: 'TBA Event',
      startDate: '2026-11-01T20:00:00+01:00',
      venueName: 'Reference Club',
      officialWebsiteUrl: 'https://official.example/events/tba',
      lineupState: 'tba',
      lineupReason: 'lineup_explicitly_tba',
    };

    const result = new ImportRunner().run([official]);

    expect(result.canonicalEvent?.lineup).toBeUndefined();
    expect(result.canonicalEvent?.lineupState).toBe('tba');
    expect(result.canonicalEvent?.lineupReason).toBe('lineup_explicitly_tba');
    expect(result.missingOptionalFields).not.toContain('lineup');
  });

  it('routes a different ticket date to review', () => {
    const outputs = fixture('Underland');
    outputs[1] = {
      ...outputs[1]!,
      startDate: '2026-10-04T23:00:00+02:00',
    };

    const result = new ImportRunner().run(outputs);

    expect(result.decision).toBe('review');
    expect(result.reviewReasons).toContain(
      `identity_date_mismatch:${outputs[1]!.sourceId}`,
    );
  });

  it('routes a different ticket venue to review', () => {
    const outputs = fixture('R3HAB');
    outputs[1] = { ...outputs[1]!, venueName: 'Other Hall' };

    const result = new ImportRunner().run(outputs);

    expect(result.decision).toBe('review');
    expect(result.reviewReasons).toContain(
      `identity_venue_mismatch:${outputs[1]!.sourceId}`,
    );
  });

  it('isolates the CHROME contribution from the MDMA event', () => {
    const result = new ImportRunner().run(fixture('MDMA/CHROME conflict'));

    expect(result.decision).toBe('publish_partial');
    expect(result.canonicalEvent?.title).toBe('MDMA - Musik Die Mich Antreibt');
    expect(result.canonicalEvent?.ticketUrl).toContain('ticketkings.de');
    expect(result.canonicalEvent?.ticketUrl).not.toContain('chrome');
    expect(
      result.reviewReasons.some((reason) =>
        reason.startsWith('identity_date_mismatch:chrome-'),
      ),
    ).toBe(true);
  });

  it('treats a missing genre as optional', () => {
    const result = new ImportRunner().run(fixture('Bootshaus Sommerfest'));

    expect(result.decision).toBe('publish_partial');
    expect(result.missingRequiredFields).toHaveLength(0);
    expect(result.missingOptionalFields).toContain('genres');
  });

  it('has no canonical or DB fallback for unverified connector fields', () => {
    const output: ConnectorOutput = {
      sourceId: 'unverified-source',
      sourceFamily: 'official_website',
      sourceUrl: 'https://official.example/events/unverified',
      title: 'Unverified Event',
      startDate: '2026-12-01T20:00:00+01:00',
      venueName: 'Reference Club',
      officialWebsiteUrl: 'https://official.example/events/unverified',
    };

    const result = new ImportRunner().run([output]);

    expect(result.decision).toBe('reject');
    expect(result.canonicalEvent).toBeUndefined();
    expect(result.evidence[0]?.diagnostics).toContain('verified_at:missing');
  });

  it('preserves a confirmed historical event missing from the current live listing', () => {
    expect(
      resolveMissingLiveEvidenceDisposition({
        existingEventId: 'existing-historical',
        endDate: '2026-08-08T06:00:00+02:00',
        hasLiveEvidence: false,
        now: new Date('2026-08-10T20:00:00.000Z'),
      }),
    ).toBe('historical_preserve');
  });

  it('routes an active event without live evidence to review', () => {
    expect(
      resolveMissingLiveEvidenceDisposition({
        existingEventId: 'existing-active',
        endDate: '2026-09-08T06:00:00+02:00',
        hasLiveEvidence: false,
        now: new Date('2026-08-10T20:00:00.000Z'),
      }),
    ).toBe('review');
  });

  it('blocks a mapped identity with a different local calendar day', () => {
    const result = evaluateSourceNativeIdentityCompatibility(
      {
        title: 'Reference Event',
        startDate: '2026-08-15T22:00:00+02:00',
        venueName: 'Reference Club',
      },
      {
        title: 'Reference Event',
        startDate: '2026-09-19T22:00:00+02:00',
        venueName: 'Reference Club',
      },
    );
    expect(result.compatible).toBe(false);
    expect(result.reasons).toContain('date_mismatch');
  });

  it('blocks a mapped identity with a different venue', () => {
    const result = evaluateSourceNativeIdentityCompatibility(
      {
        title: 'Reference Event',
        startDate: '2026-09-05T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
      {
        title: 'Reference Event',
        startDate: '2026-09-05T22:00:00+02:00',
        venueName: 'Essigfabrik',
      },
    );
    expect(result.compatible).toBe(false);
    expect(result.reasons).toContain('venue_mismatch');
  });

  it('does not merge a different event because the organizer is equal', () => {
    const result = evaluateSourceNativeIdentityCompatibility(
      {
        title: 'First Event',
        startDate: '2026-08-15T22:00:00+02:00',
        venueName: 'Bootshaus',
        organizerName: 'Same Organizer',
      },
      {
        title: 'Second Event',
        startDate: '2026-09-19T22:00:00+02:00',
        venueName: 'Essigfabrik',
        organizerName: 'Same Organizer',
      },
    );
    expect(result.compatible).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['title_mismatch', 'date_mismatch', 'venue_mismatch']),
    );
  });

  it('drops a zero price without explicit free evidence', () => {
    const evidence = new SourceAdapter().adapt({
      sourceId: 'zero-ticket',
      sourceFamily: 'ticket_io',
      sourceUrl: 'https://reference.ticket.io/zero/',
      verifiedAt: VERIFIED_AT,
      publicTicketUrl: 'https://reference.ticket.io/zero/',
      admissionPrice: { amount: 0, currency: 'EUR', text: 'ab 0,00 €' },
      ticketPhases: [
        {
          id: 'phase-zero',
          name: 'List admission',
          sortOrder: 0,
          kind: 'regular',
          priceAmount: 0,
          priceCurrency: 'EUR',
          isFree: false,
          available: true,
          soldOut: false,
        },
      ],
    });
    expect(evidence.tickets.admissionPrice).toBeUndefined();
    expect(evidence.tickets.ticketPhases).toBeUndefined();
    expect(evidence.diagnostics).toContain('ticket_price_zero_unverified');
  });

  it('derives on_sale from a visible purchaseable admission phase', () => {
    const evidence = new SourceAdapter().adapt({
      sourceId: 'sale-ticket',
      sourceFamily: 'ticket_kings',
      sourceUrl: 'https://ticketkings.de/event/sale/',
      verifiedAt: VERIFIED_AT,
      publicTicketUrl: 'https://ticketkings.de/event/sale/',
      admissionPrice: { amount: 18, currency: 'EUR' },
      ticketPhases: [
        {
          id: 'phase-sale',
          name: 'Admission',
          sortOrder: 0,
          kind: 'regular',
          priceAmount: 18,
          priceCurrency: 'EUR',
          isFree: false,
          available: true,
          soldOut: false,
          purchaseUrl: 'https://ticketkings.de/event/sale/',
        },
      ],
    });
    expect(evidence.tickets.ticketStatus?.value).toBe('on_sale');
  });

  it('removes HTML and transport prose from lineup evidence', () => {
    const evidence = new SourceAdapter().adapt({
      sourceId: 'lineup-official',
      sourceFamily: 'official_website',
      sourceUrl: 'https://official.example/events/lineup',
      verifiedAt: VERIFIED_AT,
      title: 'Lineup Event',
      startDate: '2026-09-05T22:00:00+02:00',
      venueName: 'Reference Club',
      officialWebsiteUrl: 'https://official.example/events/lineup',
      lineupState: 'explicit_artists',
      lineup: [
        {
          sortOrder: 0,
          displayName: 'DJ Alpha',
          rawSourceSpelling: 'DJ Alpha',
          normalizedName: 'dj alpha',
          billingRelation: 'SOLO',
          isB2b: false,
          isF2f: false,
          isLiveSet: false,
          confidence: 0.9,
          reviewState: 'accepted',
          inclusionReason: 'structured_lineup',
        },
        {
          sortOrder: 1,
          displayName: 'Public transport tickets included for an easy ride in and out',
          rawSourceSpelling: 'Public transport tickets included for an easy ride in and out',
          normalizedName: 'public transport tickets included for an easy ride in and out',
          billingRelation: 'SOLO',
          isB2b: false,
          isF2f: false,
          isLiveSet: false,
          confidence: 0.2,
          reviewState: 'accepted',
          inclusionReason: 'description_text',
        },
        {
          sortOrder: 2,
          displayName: '">Line-Up Genres',
          rawSourceSpelling: '">Line-Up Genres',
          normalizedName: 'line up genres',
          billingRelation: 'SOLO',
          isB2b: false,
          isF2f: false,
          isLiveSet: false,
          confidence: 0.2,
          reviewState: 'accepted',
          inclusionReason: 'html_fragment',
        },
      ],
    });
    expect(evidence.content.lineup?.value.map((entry) => entry.displayName)).toEqual([
      'DJ Alpha',
    ]);
    expect(evidence.diagnostics).toContain('lineup_entries_filtered:2');
  });

  it('passes all seven offline reference fixture regressions', () => {
    const results = REFERENCE_FIXTURES.map((entry) => ({
      name: entry.name,
      result: new ImportRunner().run(entry.outputs),
    }));

    expect(results).toHaveLength(7);
    expect(
      results.every(({ result }) =>
        result.decision === 'publish' || result.decision === 'publish_partial',
      ),
    ).toBe(true);
    expect(
      results.find(({ name }) => name === 'MDMA/CHROME conflict')?.result
        .canonicalEvent?.ticketUrl,
    ).not.toContain('chrome');
  });
});
