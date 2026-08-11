import { describe, expect, it } from 'vitest';

import type { SourceRecord } from '@/data/types/records';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';

import {
  CleanMultiSourceImportService,
  type CleanImportSourceCollection,
} from '../clean-multi-source-import-service';
import { NoopCleanImportPersistence } from '../clean-import-persistence';
import type { CleanSourceFamily, ConnectorOutput } from '../event-evidence';
import { REFERENCE_FIXTURES } from './fixtures/reference-fixtures';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function source(id: string, family: CleanSourceFamily): SourceRecord {
  return {
    id,
    displayName: id,
    sourceType: family === 'official_website' ? 'website' : 'ticket_platform',
    enabled: true,
    archived: false,
    sourceConfig:
      family === 'official_website'
        ? {}
        : {
            ticketPlatform: {
              platform: family === 'ticket_io' ? 'ticket_io' : 'ticket_king',
            },
          },
  } as SourceRecord;
}

function raw(output: ConnectorOutput): RawImportedEvent {
  const ticketOffers = output.ticketPhases?.map((phase) => ({
    name: phase.name,
    priceAmount: phase.priceAmount,
    priceCurrency: phase.priceCurrency,
    purchaseUrl: phase.purchaseUrl,
    available: phase.available,
    soldOut: phase.soldOut,
  }));
  return {
    externalId: output.sourceId,
    importId: output.sourceId,
    sourceUrl: output.sourceUrl,
    eventUrl: output.sourceUrl,
    title: output.title,
    description: output.description,
    startDate: output.startDate,
    endDate: output.endDate,
    venueName: output.venueName,
    venueAddress: output.locationText,
    genreNames: output.genres,
    artistNames: output.lineup?.map((entry) => entry.displayName),
    ticketUrl: output.publicTicketUrl ?? output.outboundTicketUrls?.[0],
    minimumAge: output.minimumAge ? Number.parseInt(output.minimumAge, 10) : undefined,
    priceAmount: output.admissionPrice?.amount,
    priceCurrency: output.admissionPrice?.currency,
    priceText: output.admissionPrice?.text,
    rawSourceType: 'html',
    sourceMetadata: {
      verifiedAt: output.verifiedAt,
      pageTitle: output.title,
      eventDate: output.startDate,
      venueName: output.venueName,
      publicTicketPageUrl: output.publicTicketUrl,
      checkoutEvidenceUrl: output.checkoutEvidenceUrl,
      outboundTicketLinks: output.outboundTicketUrls,
      venueEnvironment: output.venueEnvironment,
      lineupEntries: output.lineup,
      ticketOffers,
      excludedProducts: output.excludedProducts,
      ticketStatus: output.ticketStatus,
    },
  };
}

class FixtureCollection implements CleanImportSourceCollection {
  constructor(
    private readonly outputs: ConnectorOutput[],
    private readonly failingSourceIds = new Set<string>(),
    private readonly reverse = false,
  ) {}

  async listActiveSources(): Promise<SourceRecord[]> {
    const records = this.outputs.map((output) => source(output.sourceId, output.sourceFamily));
    return this.reverse ? records.reverse() : records;
  }

  async executeSource(record: SourceRecord): Promise<RawImportedEvent[]> {
    if (this.failingSourceIds.has(record.id)) {
      throw new Error(`source_failed:${record.id}`);
    }
    return this.outputs.filter((output) => output.sourceId === record.id).map(raw);
  }
}

function official(
  id: string,
  title: string,
  date: string,
  venue = 'Reference Club',
  ticketUrl = `https://tickets.example/${id}`,
): ConnectorOutput {
  return {
    sourceId: `${id}-official`,
    sourceFamily: 'official_website',
    sourceUrl: `https://official.example/${id}`,
    verifiedAt: '2026-01-01T00:00:00.000Z',
    title,
    startDate: date,
    venueName: venue,
    officialWebsiteUrl: `https://official.example/${id}`,
    outboundTicketUrls: [ticketUrl],
    description: `${title} description`,
    genres: ['Techno'],
  };
}

function ticket(
  id: string,
  family: 'ticket_io' | 'ticket_kings',
  title: string,
  date: string,
  venue = 'Reference Club',
  ticketUrl = `https://tickets.example/${id}`,
): ConnectorOutput {
  return {
    sourceId: `${id}-${family}`,
    sourceFamily: family,
    sourceUrl: ticketUrl,
    verifiedAt: '2026-01-01T00:00:00.000Z',
    title,
    startDate: date,
    venueName: venue,
    publicTicketUrl: ticketUrl,
    admissionPrice: { amount: 20, currency: 'EUR', text: '20,00 €' },
    ticketPhases: [
      {
        id: `${id}-admission`,
        name: 'Admission',
        sortOrder: 0,
        kind: 'regular',
        priceAmount: 20,
        priceCurrency: 'EUR',
        available: true,
        soldOut: false,
        purchaseUrl: ticketUrl,
      },
    ],
    ticketStatus: 'on_sale',
  };
}

async function run(
  outputs: ConnectorOutput[],
  options?: { failing?: Set<string>; reverse?: boolean; now?: Date },
) {
  return new CleanMultiSourceImportService(
    new FixtureCollection(outputs, options?.failing, options?.reverse),
  ).run({
    now: options?.now ?? NOW,
    persistence: new NoopCleanImportPersistence(),
  });
}

describe('CleanMultiSourceImportService', () => {
  it.each(['ticket_io', 'ticket_kings'] as const)(
    'clusters matching official and %s evidence',
    async (family) => {
      const outputs = [
        official('same-event', 'Same Event', '2026-09-01T20:00:00+02:00'),
        ticket('same-event', family, 'Same Event', '2026-09-01T20:00:00+02:00'),
      ];
      const result = await run(outputs);

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0]?.contributionIds).toHaveLength(2);
      expect(result.canonicalEvents).toHaveLength(1);
    },
  );

  it('keeps the same organizer on another day separate', async () => {
    const outputs = [
      official('day-one', 'Organizer Night', '2026-09-01T20:00:00+02:00'),
      official('day-two', 'Organizer Night', '2026-09-02T20:00:00+02:00'),
    ];
    expect((await run(outputs)).clusters).toHaveLength(2);
  });

  it('keeps similar titles at incompatible venues separate', async () => {
    const outputs = [
      official('venue-one', 'Warehouse Session', '2026-09-01T20:00:00+02:00', 'Hall One'),
      official('venue-two', 'Warehouse Sessions', '2026-09-01T20:00:00+02:00', 'Hall Two'),
    ];
    expect((await run(outputs)).clusters).toHaveLength(2);
  });

  it('ignores stale mappedEventId metadata', async () => {
    const left = official('mapped-left', 'Left Event', '2026-09-01T20:00:00+02:00');
    const right = official('mapped-right', 'Right Event', '2026-09-02T20:00:00+02:00');
    const collection = new FixtureCollection([left, right]);
    const originalExecute = collection.executeSource.bind(collection);
    collection.executeSource = async (record) =>
      (await originalExecute(record)).map((event) => ({
        ...event,
        sourceMetadata: {
          ...event.sourceMetadata,
          mappedEventId: 'stale-shared-id',
        },
      }));

    expect(
      (
        await new CleanMultiSourceImportService(collection).run({
          now: NOW,
        })
      ).clusters,
    ).toHaveLength(2);
  });

  it('isolates contradictory ticket evidence', async () => {
    const outputs = [
      official('safe', 'Safe Event', '2026-09-01T20:00:00+02:00'),
      ticket('safe', 'ticket_io', 'Safe Event', '2026-09-01T20:00:00+02:00'),
      ticket('wrong', 'ticket_kings', 'Other Event', '2026-09-02T20:00:00+02:00'),
    ];
    const result = await run(outputs);

    expect(result.clusters).toHaveLength(2);
    expect(result.canonicalEvents[0]?.title).toBe('Safe Event');
    expect(result.decisions.some((entry) => entry.decision === 'review')).toBe(true);
  });

  it('keeps official and ticket URL roles separate', async () => {
    const outputs = [
      official('roles', 'Role Event', '2026-09-01T20:00:00+02:00'),
      ticket('roles', 'ticket_io', 'Role Event', '2026-09-01T20:00:00+02:00'),
    ];
    const canonical = (await run(outputs)).canonicalEvents[0]!;

    expect(canonical.websiteUrl).toBe('https://official.example/roles');
    expect(canonical.ticketUrl).toBe('https://tickets.example/roles');
  });

  it('excludes add-ons from admission price', async () => {
    const officialOutput = official('admission', 'Admission Event', '2026-09-01T20:00:00+02:00');
    const ticketOutput = ticket(
      'admission',
      'ticket_kings',
      'Admission Event',
      '2026-09-01T20:00:00+02:00',
    );
    ticketOutput.excludedProducts = [
      { name: 'Ticket Flex', reason: 'optional_add_on', priceAmount: 2.5 },
    ];
    const result = await run([officialOutput, ticketOutput]);

    expect(result.canonicalEvents[0]?.admissionPrice?.amount).toBe(20);
    expect(
      result.contributions.find((entry) => entry.sourceFamily === 'ticket_kings')?.tickets
        .excludedProducts?.value,
    ).toEqual([expect.objectContaining({ name: 'Ticket Flex' })]);
  });

  it('retains lineup quality filtering', async () => {
    const output = official('lineup', 'Lineup Event', '2026-09-01T20:00:00+02:00');
    output.lineup = [
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
        inclusionReason: 'fixture',
      },
      {
        sortOrder: 1,
        displayName: '<b>Navigation</b>',
        rawSourceSpelling: '<b>Navigation</b>',
        normalizedName: 'navigation',
        billingRelation: 'SOLO',
        isB2b: false,
        isF2f: false,
        isLiveSet: false,
        confidence: 0.2,
        reviewState: 'accepted',
        inclusionReason: 'fixture',
      },
    ];

    expect(
      (await run([output])).canonicalEvents[0]?.lineup?.map((entry) => entry.displayName),
    ).toEqual(['DJ Alpha']);
  });

  it('continues after one source fails', async () => {
    const good = official('good', 'Good Event', '2026-09-01T20:00:00+02:00');
    const bad = official('bad', 'Bad Event', '2026-09-01T20:00:00+02:00');
    const result = await run([bad, good], {
      failing: new Set([bad.sourceId]),
    });

    expect(result.diagnostics.successfulSourceCount).toBe(1);
    expect(result.diagnostics.failedSourceCount).toBe(1);
    expect(result.canonicalEvents[0]?.title).toBe('Good Event');
  });

  it('is independent of source input order', async () => {
    const outputs = [
      official('order', 'Order Event', '2026-09-01T20:00:00+02:00'),
      ticket('order', 'ticket_io', 'Order Event', '2026-09-01T20:00:00+02:00'),
    ];
    const normal = await run(outputs);
    const reversed = await run([...outputs].reverse(), { reverse: true });

    expect(reversed.clusters).toEqual(normal.clusters);
    expect(reversed.canonicalEvents).toEqual(normal.canonicalEvents);
    expect(reversed.decisions).toEqual(normal.decisions);
  });

  it('marks past source-evidenced events historical_preserve', async () => {
    const result = await run(
      [official('history', 'Historical Event', '2025-01-01T20:00:00+01:00')],
      { now: NOW },
    );

    expect(result.decisions[0]?.decision).toBe('historical_preserve');
  });

  it('uses a persistence boundary with zero writes', async () => {
    const result = await run([official('noop', 'Noop Event', '2026-09-01T20:00:00+02:00')]);
    expect(result.diagnostics.databaseWriteOperations).toBe(0);
  });

  it('passes all seven reference fixtures through the service', async () => {
    const results = await Promise.all(REFERENCE_FIXTURES.map((fixture) => run(fixture.outputs)));

    expect(results).toHaveLength(7);
    expect(
      results.every(
        (result) =>
          result.canonicalEvents.length === 1 &&
          result.decisions.some(
            (decision) =>
              decision.decision === 'publish' || decision.decision === 'publish_partial',
          ),
      ),
    ).toBe(true);
  });
});
