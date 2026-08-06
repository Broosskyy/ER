import { describe, expect, it } from 'vitest';

import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import type { ImportRecord } from '@/features/import/models/types';
import {
  buildAdminEventFromImportFields,
  buildImportPublishFieldPatch,
  mergeImportPublishFields,
} from '@/features/import/services/import-event-field-mapper';

function baseCandidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'ext-bootshaus-1',
    sourceId: 'source-bootshaus-koeln',
    sourceName: 'Bootshaus',
    title: 'PLAY! Open Air – Mallorca',
    description: 'Real description',
    startDate: '2026-08-01T14:00:00+02:00',
    endDate: '2026-08-01T22:00:00+02:00',
    timezone: 'Europe/Berlin',
    venueName: 'Beach Club Mallorca',
    venueAddress: 'Passeig Marítim 12, 07014 Palma',
    cityName: 'Palma',
    countryCode: 'ES',
    latitude: 39.5696,
    longitude: 2.6502,
    organizerName: 'Bootshaus',
    genreNames: ['Techno', 'House'],
    ticketUrl: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
    priceText: 'ab 15,00 €',
    minimumAge: 18,
    doorsOpenAt: '2026-08-01T13:00:00+02:00',
    rawSourceType: 'json_ld',
    sourceMetadata: {
      externalLocationFromTitle: true,
      eventGeography: { venue: 'explicit', city: 'explicit' },
      pageTitle: 'PLAY! Open Air – Mallorca',
      listRowTitle: 'PLAY! Open Air – Mallorca',
      eventDate: '2026-08-01T14:00:00+02:00',
      venueName: 'Beach Club Mallorca',
      verifiedAt: '2026-01-01T00:00:00.000Z',
      ticketOffers: [
        { name: 'Early Bird', priceAmount: 15, priceCurrency: 'EUR' },
        { name: 'Regular', priceAmount: 20, priceCurrency: 'EUR' },
      ],
      minimumAge: 18,
      soldOut: false,
    },
    ...overrides,
  };
}

function baseRecord(candidate: CanonicalImportEvent): ImportRecord {
  return {
    id: 'import-1',
    importJobId: 'job-1',
    sourceId: candidate.sourceId,
    sourceName: candidate.sourceName,
    externalId: candidate.externalId,
    status: 'approved',
    normalizedPayload: candidate,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    retrievedAt: '2026-01-01T00:00:00.000Z',
  };
}

function existingEvent(): AdminEventRecord {
  return {
    id: 'evt-existing',
    title: 'Old title',
    description: 'Existing description',
    startDate: '2026-08-01T14:00:00+02:00',
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    venueId: 'venue-bootshaus-koeln',
    priceText: 'ab 12,00 €',
    ticketUrl: 'https://bootshaus-club.ticket.io/old/',
    sourceId: 'source-bootshaus-koeln',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('import publish field mapper', () => {
  const fieldCases: Array<{
    name: string;
    patch: Partial<ReturnType<typeof buildImportPublishFieldPatch>>;
    assert: (event: AdminEventRecord) => void;
  }> = [
    {
      name: 'latitude',
      patch: { latitude: 39.5696 },
      assert: (event) => expect(event.latitude).toBe(39.5696),
    },
    {
      name: 'longitude',
      patch: { longitude: 2.6502 },
      assert: (event) => expect(event.longitude).toBe(2.6502),
    },
    {
      name: 'minimumAge → ageRestriction',
      patch: { ageRestriction: 'ab 18 Jahren' },
      assert: (event) => expect(event.ageRestriction).toBe('ab 18 Jahren'),
    },
    {
      name: 'venueName',
      patch: { venueName: 'Beach Club Mallorca' },
      assert: (event) => expect(event.venueName).toBe('Beach Club Mallorca'),
    },
    {
      name: 'venueAddress',
      patch: { venueAddress: 'Passeig Marítim 12, 07014 Palma' },
      assert: (event) => expect(event.venueAddress).toContain('Palma'),
    },
    {
      name: 'postal code',
      patch: { venuePostalCode: '07014' },
      assert: (event) => expect(event.venuePostalCode).toBe('07014'),
    },
    {
      name: 'city',
      patch: { venueCity: 'Palma' },
      assert: (event) => expect(event.venueCity).toBe('Palma'),
    },
    {
      name: 'country',
      patch: { venueCountryCode: 'ES' },
      assert: (event) => expect(event.venueCountryCode).toBe('ES'),
    },
    {
      name: 'timezone',
      patch: { timezone: 'Europe/Berlin' },
      assert: (event) => expect(event.timezone).toBe('Europe/Berlin'),
    },
    {
      name: 'doorsOpenAt',
      patch: { doorsOpenAt: '2026-08-01T13:00:00+02:00' },
      assert: (event) => expect(event.doorsOpenAt).toContain('2026-08-01'),
    },
    {
      name: 'startDate',
      patch: { startDate: '2026-08-01T14:00:00+02:00' },
      assert: (event) => expect(event.startDate).toContain('2026-08-01T14:00:00'),
    },
    {
      name: 'endDate',
      patch: { endDate: '2026-08-01T22:00:00+02:00' },
      assert: (event) => expect(event.endDate).toContain('2026-08-01T22:00:00'),
    },
    {
      name: 'organizer',
      patch: { organizerName: 'Bootshaus' },
      assert: (event) => expect(event.organizerName).toBe('Bootshaus'),
    },
    {
      name: 'description',
      patch: { description: 'Real description' },
      assert: (event) => expect(event.description).toBe('Real description'),
    },
    {
      name: 'genres',
      patch: { genreLabels: ['Techno', 'House'] },
      assert: (event) => expect(event.genreLabels).toEqual(['Techno', 'House']),
    },
    {
      name: 'ticketUrl',
      patch: { ticketUrl: 'https://bootshaus-club.ticket.io/gPHSUV3l/' },
      assert: (event) => expect(event.ticketUrl).toContain('gPHSUV3l'),
    },
    {
      name: 'priceText',
      patch: { priceText: 'ab 15,00 €' },
      assert: (event) => expect(event.priceText).toMatch(/15/),
    },
    {
      name: 'ticketStatus',
      patch: { ticketStatus: 'on_sale' },
      assert: (event) => expect(event.ticketStatus).toBe('on_sale'),
    },
    {
      name: 'ticketPhases',
      patch: { ticketPhases: [{ id: 'p1', name: 'Early Bird', sortOrder: 0, kind: 'early_bird' }] },
      assert: (event) => expect(event.ticketPhases?.[0]?.name).toBe('Early Bird'),
    },
  ];

  it('maps all normalized publish fields on create', () => {
    const candidate = baseCandidate();
    const event = buildAdminEventFromImportFields({
      record: baseRecord(candidate),
      candidate,
    });

    for (const fieldCase of fieldCases) {
      fieldCase.assert(event);
    }
  });

  it('create and full update paths share semantics', () => {
    const candidate = baseCandidate();
    const created = buildAdminEventFromImportFields({
      record: baseRecord(candidate),
      candidate,
    });
    const updated = mergeImportPublishFields({
      existing: {
        ...existingEvent(),
        title: candidate.title,
        venueName: candidate.venueName,
        venueCity: candidate.cityName,
      },
      candidate,
      fillOnly: false,
    });

    expect(updated.latitude).toBe(created.latitude);
    expect(updated.longitude).toBe(created.longitude);
    expect(updated.venueCity).toBe(created.venueCity);
    expect(updated.ticketPhases?.length).toBe(created.ticketPhases?.length);
    expect(updated.priceText).toBe(created.priceText);
  });

  it('never overwrites meaningful values with empty enrichment', () => {
    const candidate = baseCandidate({
      description: '',
      priceText: '',
      venueName: '',
      ticketUrl: '',
      sourceMetadata: { ticketOffers: [] },
    });
    const merged = mergeImportPublishFields({
      existing: existingEvent(),
      candidate,
      fillOnly: true,
    });
    expect(merged.description).toBe('Existing description');
    expect(merged.priceText).toBe('ab 12,00 €');
    expect(merged.venueName).toBe('Bootshaus');
    expect(merged.ticketUrl).toBe('https://bootshaus-club.ticket.io/old/');
  });

  it('clears wrong bootshaus venue linkage for external geography', () => {
    const candidate = baseCandidate();
    const merged = mergeImportPublishFields({
      existing: existingEvent(),
      candidate,
    });
    expect(merged.venueId).toBeUndefined();
    expect(merged.venueName).toBe('Beach Club Mallorca');
    expect(merged.venueCity).toBe('Palma');
  });

  it('does not downgrade better ticket phases on enrichment', () => {
    const existing = existingEvent();
    existing.ticketPhases = [
      {
        id: 'phase-regular',
        name: 'Regular',
        sortOrder: 1,
        kind: 'regular',
        priceAmount: 20,
        priceLabel: '20,00 €',
      },
    ];
    const candidate = baseCandidate({
      sourceMetadata: {
        pageTitle: 'PLAY! Open Air – Mallorca',
        listRowTitle: 'PLAY! Open Air – Mallorca',
        eventDate: '2026-08-01T14:00:00+02:00',
        venueName: 'Beach Club Mallorca',
        verifiedAt: '2026-01-01T00:00:00.000Z',
        ticketOffers: [{ name: 'Regular', priceAmount: 10 }],
      },
    });
    const merged = mergeImportPublishFields({
      existing,
      candidate,
      fillOnly: true,
    });
    expect(merged.ticketPhases?.[0]?.priceAmount).toBe(20);
  });
});
