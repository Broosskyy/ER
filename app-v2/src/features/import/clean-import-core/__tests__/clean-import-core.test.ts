import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DetailEvidenceService } from '@/features/import/clean-import-core/detail-evidence-service';
import { parseDetailEvidenceFromHtml } from '@/features/import/clean-import-core/detail-evidence-parser';
import type { ConnectorOutput } from '@/features/import/clean-import-core/event-evidence';
import { ImportRunner } from '@/features/import/clean-import-core/import-runner';

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
