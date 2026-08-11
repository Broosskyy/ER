import { describe, expect, it } from 'vitest';

import {
  CleanMultiSourceImportService,
  type CleanImportSourceCollection,
} from '../clean-multi-source-import-service';
import {
  CrossSourceEventResolver,
  isConcreteEventUrl,
} from '../cross-source-event-resolver';
import type { EventEvidence } from '../event-evidence';
import { bridgeProductionSourceEvidence } from '../production-evidence-bridge';
import { SourceAdapter } from '../source-adapter';
import { ImportRunner } from '../import-runner';
import { REFERENCE_FIXTURES } from './fixtures/reference-fixtures';

const OBSERVED_AT = '2026-08-10T18:00:00.000Z';

function adaptOfficial(raw: Parameters<typeof bridgeProductionSourceEvidence>[0]['rawEvent']) {
  const bridged = bridgeProductionSourceEvidence({
    sourceId: 'official-source',
    sourceFamily: 'official_website',
    rawEvent: raw,
    fetchVerifiedAt: OBSERVED_AT,
  });
  return new SourceAdapter().adapt(bridged.output);
}

function adaptTicket(raw: Parameters<typeof bridgeProductionSourceEvidence>[0]['rawEvent']) {
  const bridged = bridgeProductionSourceEvidence({
    sourceId: 'ticket-source',
    sourceFamily: 'ticket_kings',
    rawEvent: raw,
    fetchVerifiedAt: OBSERVED_AT,
  });
  return new SourceAdapter().adapt(bridged.output);
}

function contribution(
  contributionId: string,
  externalId: string,
  evidence: EventEvidence,
) {
  return { contributionId, externalId, evidence };
}

describe('evidence transfer and cluster boundaries', () => {
  it('maps website connector title/date/venue into EventEvidence', () => {
    const evidence = adaptOfficial({
      externalId: 'bc173',
      importId: 'bc173',
      sourceUrl: 'https://bootshaus.tv/events/bc173',
      eventUrl: 'https://bootshaus.tv/events/bc173',
      title: 'BC173',
      startDate: '2026-08-15T22:00:00+02:00',
      venueName: 'Bootshaus',
      cityName: 'Köln',
      rawSourceType: 'json_ld',
      sourceMetadata: {
        fieldEvidence: [{ field: 'title', extractedAt: OBSERVED_AT }],
      },
    });

    expect(evidence.identity.title?.value).toBe('BC173');
    expect(evidence.identity.startDate?.value).toBe('2026-08-15T22:00:00+02:00');
    expect(evidence.identity.venueName?.value).toBe('Bootshaus');
    expect(evidence.verifiedAt).toBe(OBSERVED_AT);
  });

  it('keeps website title and date when venue is missing', () => {
    const evidence = adaptOfficial({
      externalId: 'no-venue',
      importId: 'no-venue',
      sourceUrl: 'https://official.example/events/no-venue',
      eventUrl: 'https://official.example/events/no-venue',
      title: 'No Venue Event',
      startDate: '2026-09-01T22:00:00+02:00',
      rawSourceType: 'json_ld',
      sourceMetadata: { observedAt: OBSERVED_AT },
    });

    expect(evidence.identity.title?.value).toBe('No Venue Event');
    expect(evidence.identity.startDate?.value).toBe('2026-09-01T22:00:00+02:00');
    expect(evidence.identity.venueName).toBeUndefined();
  });

  it('transfers description genres and lineup from website connector output', () => {
    const evidence = adaptOfficial({
      externalId: 'rich',
      importId: 'rich',
      sourceUrl: 'https://official.example/events/rich',
      eventUrl: 'https://official.example/events/rich',
      title: 'Rich Event',
      startDate: '2026-09-02T22:00:00+02:00',
      venueName: 'Club',
      description: 'Official description',
      genreNames: ['Techno'],
      artistNames: ['DJ Alpha'],
      minimumAge: 18,
      rawSourceType: 'json_ld',
      sourceMetadata: {
        observedAt: OBSERVED_AT,
        venueEnvironment: 'indoor',
        lineupEntries: [
          {
            displayName: 'DJ Alpha',
            normalizedName: 'dj alpha',
            source: 'structured',
            confidence: 0.9,
            sortOrder: 0,
          },
        ],
      },
    });

    expect(evidence.content.description?.value).toBe('Official description');
    expect(evidence.content.genres?.value).toEqual(['Techno']);
    expect(evidence.content.lineup?.value.map((entry) => entry.displayName)).toEqual(['DJ Alpha']);
    expect(evidence.content.minimumAge?.value).toBe('18');
    expect(evidence.content.venueEnvironment?.value).toBe('indoor');
  });

  it('uses fetch observedAt as verifiedAt when metadata has no freshness stamp', () => {
    const evidence = adaptOfficial({
      externalId: 'freshness',
      importId: 'freshness',
      sourceUrl: 'https://official.example/events/freshness',
      eventUrl: 'https://official.example/events/freshness',
      title: 'Freshness Event',
      startDate: '2026-09-03T22:00:00+02:00',
      rawSourceType: 'json_ld',
      sourceMetadata: {},
    });

    expect(evidence.verifiedAt).toBe(OBSERVED_AT);
  });

  it('does not treat shop roots as concrete event URLs', () => {
    expect(isConcreteEventUrl('https://ticketkings.de/')).toBe(false);
    expect(isConcreteEventUrl('https://bootshaus.tv/events')).toBe(false);
    expect(
      isConcreteEventUrl('https://ticketkings.de/event/underland-essigfabrik-05-09-2026/'),
    ).toBe(true);
  });

  it('keeps same source root but different calendar days in separate clusters', () => {
    const resolver = new CrossSourceEventResolver();
    const left = contribution(
      'official:a',
      'a',
      adaptOfficial({
        externalId: 'a',
        importId: 'a',
        sourceUrl: 'https://bootshaus.tv/events/event-a',
        eventUrl: 'https://bootshaus.tv/events/event-a',
        title: 'Event A',
        startDate: '2026-08-15T22:00:00+02:00',
        venueName: 'Bootshaus',
        rawSourceType: 'json_ld',
        sourceMetadata: { observedAt: OBSERVED_AT },
      }),
    );
    const right = contribution(
      'official:b',
      'b',
      adaptOfficial({
        externalId: 'b',
        importId: 'b',
        sourceUrl: 'https://bootshaus.tv/events/event-b',
        eventUrl: 'https://bootshaus.tv/events/event-b',
        title: 'Event B',
        startDate: '2026-09-05T22:00:00+02:00',
        venueName: 'Bootshaus',
        rawSourceType: 'json_ld',
        sourceMetadata: { observedAt: OBSERVED_AT },
      }),
    );

    const { clusters } = resolver.resolve([left, right]);
    expect(clusters).toHaveLength(2);
  });

  it('keeps same shop root but different venues in separate clusters', () => {
    const resolver = new CrossSourceEventResolver();
    const left = contribution(
      'ticket:a',
      'a',
      adaptTicket({
        externalId: 'a',
        importId: 'a',
        sourceUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
        eventUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
        title: 'Underland',
        startDate: '2026-09-05T22:00:00+02:00',
        venueName: 'Essigfabrik',
        rawSourceType: 'html',
        sourceMetadata: {
          observedAt: OBSERVED_AT,
          pageTitle: 'Underland',
          eventDate: '2026-09-05T22:00:00+02:00',
          venueName: 'Essigfabrik',
          publicTicketPageUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
        },
      }),
    );
    const right = contribution(
      'ticket:b',
      'b',
      adaptTicket({
        externalId: 'b',
        importId: 'b',
        sourceUrl: 'https://ticketkings.de/event/bootshaus-sommerfest-05-09-2026/',
        eventUrl: 'https://ticketkings.de/event/bootshaus-sommerfest-05-09-2026/',
        title: 'Bootshaus Sommerfest',
        startDate: '2026-09-05T22:00:00+02:00',
        venueName: 'Bootshaus',
        rawSourceType: 'html',
        sourceMetadata: {
          observedAt: OBSERVED_AT,
          pageTitle: 'Bootshaus Sommerfest',
          eventDate: '2026-09-05T22:00:00+02:00',
          venueName: 'Bootshaus',
          publicTicketPageUrl: 'https://ticketkings.de/event/bootshaus-sommerfest-05-09-2026/',
        },
      }),
    );

    const { clusters } = resolver.resolve([left, right]);
    expect(clusters).toHaveLength(2);
  });

  it('deduplicates identical ticket kings event URLs from multiple registry sources', async () => {
    const sharedUrl = 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/';
    const collection: CleanImportSourceCollection = {
      async listActiveSources() {
        return [
          {
            id: 'source-a',
            sourceType: 'ticket_platform',
            enabled: true,
            archived: false,
            sourceConfig: { ticketPlatform: { platform: 'ticket_king' } },
          } as never,
          {
            id: 'source-b',
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
            title: 'MDMA',
            startDate: '2026-10-10T22:00:00+02:00',
            venueName: 'Bootshaus',
            rawSourceType: 'html',
            sourceMetadata: {
              observedAt: OBSERVED_AT,
              pageTitle: 'MDMA',
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
    expect(result.contributions[0]?.diagnostics).toContain('registry_source_alias:source-b');
  });

  it('isolates same ticket URL with conflicting dates instead of merging', () => {
    const resolver = new CrossSourceEventResolver();
    const sharedUrl = 'https://ticketkings.de/event/conflict/';
    const left = contribution(
      'ticket:left',
      'left',
      adaptTicket({
        externalId: sharedUrl,
        importId: sharedUrl,
        sourceUrl: sharedUrl,
        title: 'Conflict A',
        startDate: '2026-10-10T22:00:00+02:00',
        rawSourceType: 'html',
        sourceMetadata: {
          observedAt: OBSERVED_AT,
          pageTitle: 'Conflict A',
          eventDate: '2026-10-10T22:00:00+02:00',
          publicTicketPageUrl: sharedUrl,
        },
      }),
    );
    const right = contribution(
      'ticket:right',
      'right',
      adaptTicket({
        externalId: sharedUrl,
        importId: sharedUrl,
        sourceUrl: sharedUrl,
        title: 'Conflict B',
        startDate: '2026-10-11T22:00:00+02:00',
        rawSourceType: 'html',
        sourceMetadata: {
          observedAt: OBSERVED_AT,
          pageTitle: 'Conflict B',
          eventDate: '2026-10-11T22:00:00+02:00',
          publicTicketPageUrl: sharedUrl,
        },
      }),
    );

    const { clusters, diagnostics } = resolver.resolve([left, right]);
    expect(clusters).toHaveLength(2);
    expect(diagnostics.some((entry) => entry.includes('date_mismatch'))).toBe(true);
  });

  it('keeps ticket URL separate from official website role', () => {
    const official = adaptOfficial({
      externalId: 'roles',
      importId: 'roles',
      sourceUrl: 'https://official.example/events/roles',
      eventUrl: 'https://official.example/events/roles',
      title: 'Roles Event',
      startDate: '2026-09-04T22:00:00+02:00',
      venueName: 'Club',
      ticketUrl: 'https://reference.ticket.io/r3hab/',
      rawSourceType: 'json_ld',
      sourceMetadata: {
        observedAt: OBSERVED_AT,
        outboundTicketLinks: ['https://reference.ticket.io/r3hab/'],
      },
    });
    const ticket = adaptTicket({
      externalId: 'ticket',
      importId: 'ticket',
      sourceUrl: 'https://reference.ticket.io/r3hab/',
      title: 'Roles Event',
      startDate: '2026-09-04T22:00:00+02:00',
      venueName: 'Club',
      rawSourceType: 'html',
      sourceMetadata: {
        observedAt: OBSERVED_AT,
        pageTitle: 'Roles Event',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Club',
        publicTicketPageUrl: 'https://reference.ticket.io/r3hab/',
      },
    });

    expect(official.identity.officialWebsiteUrl?.value).toBe('https://official.example/events/roles');
    expect(official.tickets.publicTicketUrl).toBeUndefined();
    expect(ticket.tickets.publicTicketUrl?.value).toBe('https://reference.ticket.io/r3hab/');
    expect(ticket.identity.officialWebsiteUrl).toBeUndefined();
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
