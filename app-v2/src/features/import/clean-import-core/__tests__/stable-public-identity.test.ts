import { describe, expect, it } from 'vitest';

import {
  CleanMultiSourceImportService,
  type CleanImportSourceCollection,
} from '../clean-multi-source-import-service';
import { CrossSourceEventResolver } from '../cross-source-event-resolver';
import type { ConnectorOutput, EventEvidence } from '../event-evidence';
import { ImportRunner } from '../import-runner';
import { bridgeProductionSourceEvidence } from '../production-evidence-bridge';
import { SourceAdapter } from '../source-adapter';
import { REFERENCE_FIXTURES } from './fixtures/reference-fixtures';

const OBSERVED_AT = '2026-08-10T18:00:00.000Z';

function adaptTicket(
  family: 'ticket_io' | 'ticket_kings',
  raw: Parameters<typeof bridgeProductionSourceEvidence>[0]['rawEvent'],
) {
  const bridged = bridgeProductionSourceEvidence({
    sourceId: `${family}-source`,
    sourceFamily: family,
    rawEvent: raw,
    fetchVerifiedAt: OBSERVED_AT,
  });
  return new SourceAdapter().adapt(bridged.output);
}

function ticketOutput(
  family: 'ticket_io' | 'ticket_kings',
  key: string,
  overrides: Partial<ConnectorOutput> = {},
): ConnectorOutput {
  const host = family === 'ticket_io' ? 'reference.ticket.io' : 'ticketkings.de';
  const path = family === 'ticket_io' ? key : `event/${key}`;
  const publicTicketUrl = `https://${host}/${path}/`;
  return {
    sourceId: `${key}-${family}`,
    sourceFamily: family,
    sourceUrl: publicTicketUrl,
    verifiedAt: OBSERVED_AT,
    title: overrides.title ?? 'Ticket Event',
    startDate: overrides.startDate ?? '2026-09-04T22:00:00+02:00',
    venueName: overrides.venueName ?? 'Bootshaus',
    publicTicketUrl,
    admissionPrice: { amount: 24, currency: 'EUR', text: '24,00 EUR' },
    ...overrides,
  };
}

function officialOutput(key: string, overrides: Partial<ConnectorOutput> = {}): ConnectorOutput {
  return {
    sourceId: `${key}-official`,
    sourceFamily: 'official_website',
    sourceUrl: `https://official.example/events/${key}`,
    verifiedAt: OBSERVED_AT,
    title: overrides.title ?? 'Official Event',
    startDate: overrides.startDate ?? '2026-09-04T22:00:00+02:00',
    venueName: overrides.venueName ?? 'Bootshaus',
    officialWebsiteUrl: `https://official.example/events/${key}`,
    description: 'Official description',
    ...overrides,
  };
}

function contribution(contributionId: string, externalId: string, evidence: EventEvidence) {
  return { contributionId, externalId, evidence };
}

describe('stable public identity', () => {
  it('builds a canonical event from a verified Ticket.io identity', () => {
    const result = new ImportRunner().run([
      ticketOutput('ticket_io', 'r3hab-io', { title: 'R3HAB' }),
    ]);

    expect(result.decision).toBe('publish_partial');
    expect(result.canonicalEvent?.title).toBe('R3HAB');
    expect(result.canonicalEvent?.ticketUrl).toBe('https://reference.ticket.io/r3hab-io/');
    expect(result.canonicalEvent?.websiteUrl).toBeUndefined();
  });

  it('builds a canonical event from a verified Ticket Kings identity', () => {
    const result = new ImportRunner().run([
      ticketOutput('ticket_kings', 'underland-kings', { title: 'Underland' }),
    ]);

    expect(result.decision).toBe('publish_partial');
    expect(result.canonicalEvent?.title).toBe('Underland');
    expect(result.canonicalEvent?.ticketUrl).toContain('ticketkings.de');
  });

  it('publishes ticket-only events as publish_partial when core identity is complete', () => {
    const result = new ImportRunner().run([ticketOutput('ticket_io', 'ticket-only')]);
    expect(result.decision).toBe('publish_partial');
    expect(result.missingOptionalFields).toContain('officialWebsite');
  });

  it('publishes official-only events as publish_partial when core identity is complete', () => {
    const result = new ImportRunner().run([officialOutput('official-only')]);
    expect(result.decision).toBe('publish_partial');
    expect(result.missingOptionalFields).toContain('ticketUrl');
  });

  it('routes missing venue to review with venue_missing', () => {
    const result = new ImportRunner().run([
      ticketOutput('ticket_io', 'no-venue', { venueName: undefined }),
    ]);
    expect(result.decision).toBe('review');
    expect(result.reviewReasons).toContain('venue_missing');
  });

  it('routes missing start date to review with start_date_missing', () => {
    const result = new ImportRunner().run([
      ticketOutput('ticket_io', 'no-date', { startDate: undefined }),
    ]);
    expect(result.decision).toBe('review');
    expect(result.reviewReasons).toContain('start_date_missing');
  });

  it('routes missing verifiedAt to review', () => {
    const output = ticketOutput('ticket_io', 'unverified');
    delete output.verifiedAt;
    const result = new ImportRunner().run([output]);
    expect(result.decision).toBe('review');
    expect(result.reviewReasons).toContain('verified_at_missing');
  });

  it('never maps a ticket URL into websiteUrl', () => {
    const result = new ImportRunner().run([ticketOutput('ticket_io', 'url-role')]);
    expect(result.canonicalEvent?.websiteUrl).toBeUndefined();
    expect(result.canonicalEvent?.ticketUrl).toContain('reference.ticket.io');
  });

  it('keeps same ticket URL with different calendar days separate', () => {
    const sharedUrl = 'https://ticketkings.de/event/shared-day/';
    const resolver = new CrossSourceEventResolver();
    const left = contribution(
      'left',
      'left',
      adaptTicket('ticket_kings', {
        externalId: 'left',
        importId: 'left',
        sourceUrl: sharedUrl,
        title: 'Shared URL A',
        startDate: '2026-10-10T22:00:00+02:00',
        venueName: 'Bootshaus',
        rawSourceType: 'html',
        sourceMetadata: {
          observedAt: OBSERVED_AT,
          pageTitle: 'Shared URL A',
          eventDate: '2026-10-10T22:00:00+02:00',
          venueName: 'Bootshaus',
          publicTicketPageUrl: sharedUrl,
        },
      }),
    );
    const right = contribution(
      'right',
      'right',
      adaptTicket('ticket_kings', {
        externalId: 'right',
        importId: 'right',
        sourceUrl: sharedUrl,
        title: 'Shared URL B',
        startDate: '2026-10-11T22:00:00+02:00',
        venueName: 'Bootshaus',
        rawSourceType: 'html',
        sourceMetadata: {
          observedAt: OBSERVED_AT,
          pageTitle: 'Shared URL B',
          eventDate: '2026-10-11T22:00:00+02:00',
          venueName: 'Bootshaus',
          publicTicketPageUrl: sharedUrl,
        },
      }),
    );

    expect(resolver.resolve([left, right]).clusters).toHaveLength(2);
  });

  it('keeps same ticket URL with different venues separate', () => {
    const sharedUrl = 'https://ticketkings.de/event/shared-venue/';
    const resolver = new CrossSourceEventResolver();
    const left = contribution(
      'left',
      'left',
      adaptTicket('ticket_kings', {
        externalId: 'left',
        importId: 'left',
        sourceUrl: sharedUrl,
        title: 'Shared Venue A',
        startDate: '2026-09-05T22:00:00+02:00',
        venueName: 'Bootshaus',
        rawSourceType: 'html',
        sourceMetadata: {
          observedAt: OBSERVED_AT,
          pageTitle: 'Shared Venue A',
          eventDate: '2026-09-05T22:00:00+02:00',
          venueName: 'Bootshaus',
          publicTicketPageUrl: sharedUrl,
        },
      }),
    );
    const right = contribution(
      'right',
      'right',
      adaptTicket('ticket_kings', {
        externalId: 'right',
        importId: 'right',
        sourceUrl: sharedUrl,
        title: 'Shared Venue B',
        startDate: '2026-09-05T22:00:00+02:00',
        venueName: 'Essigfabrik',
        rawSourceType: 'html',
        sourceMetadata: {
          observedAt: OBSERVED_AT,
          pageTitle: 'Shared Venue B',
          eventDate: '2026-09-05T22:00:00+02:00',
          venueName: 'Essigfabrik',
          publicTicketPageUrl: sharedUrl,
        },
      }),
    );

    expect(resolver.resolve([left, right]).clusters).toHaveLength(2);
  });

  it('deduplicates identical Ticket Kings registry URLs into one contribution', async () => {
    const sharedUrl = 'https://ticketkings.de/event/registry-dedup/';
    const collection: CleanImportSourceCollection = {
      async listActiveSources() {
        return [
          {
            id: 'registry-a',
            sourceType: 'ticket_platform',
            enabled: true,
            archived: false,
            sourceConfig: { ticketPlatform: { platform: 'ticket_king' } },
          } as never,
          {
            id: 'registry-b',
            sourceType: 'ticket_platform',
            enabled: true,
            archived: false,
            sourceConfig: { ticketPlatform: { platform: 'ticket_king' } },
          } as never,
        ];
      },
      async executeSource(source) {
        return [
          {
            externalId: sharedUrl,
            importId: sharedUrl,
            sourceUrl: sharedUrl,
            eventUrl: sharedUrl,
            title: 'Registry Dedup',
            startDate: '2026-10-10T22:00:00+02:00',
            venueName: 'Bootshaus',
            rawSourceType: 'html',
            sourceMetadata: {
              observedAt: OBSERVED_AT,
              pageTitle: 'Registry Dedup',
              eventDate: '2026-10-10T22:00:00+02:00',
              venueName: 'Bootshaus',
              publicTicketPageUrl: sharedUrl,
            },
          },
        ];
      },
    };

    const result = await new CleanMultiSourceImportService(collection).run();
    expect(result.diagnostics.contributionCount).toBe(1);
    expect(result.canonicalEvents).toHaveLength(1);
  });

  it('passes all seven offline reference fixture regressions', () => {
    const results = REFERENCE_FIXTURES.map((entry) => ({
      name: entry.name,
      result: new ImportRunner().run(entry.outputs),
    }));
    expect(results).toHaveLength(7);
    expect(
      results.every(
        ({ result }) => result.decision === 'publish' || result.decision === 'publish_partial',
      ),
    ).toBe(true);
  });
});
