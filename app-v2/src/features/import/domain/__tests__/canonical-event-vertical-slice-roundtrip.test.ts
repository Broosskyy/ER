import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/events/data/demo-images', () => ({
  getSourceDisplayLabel: (source: string) => source,
  getEventImageAsset: () => 0,
  EVENT_IMAGE_ASSETS: {},
  resolveEventImageSource: () => 0,
}));

import { buildCanonicalEventFromVerifiedPublicEvidence } from '@/features/import/domain/build-canonical-event-from-verified-public-evidence';
import { GOLDEN_REFERENCE_IMPORT_FIXTURES } from '@/features/import/domain/__tests__/fixtures/golden-reference-import-fixtures';
import { toEventDisplayModel } from '@/features/events/formatting/display-event';
import {
  toEventHeroViewModel,
  toEventInfoViewModel,
  toLineupSectionViewModel,
} from '@/features/event-detail/utils/event-detail-view-model';
import {
  lineupBillingLabelsFromDomainEvent,
  mapPersistenceReadbackToDomainEvent,
} from '@/features/import/services/canonical-event-consumer-readback';
import {
  buildCanonicalEventPersistencePayload,
  toEventRowPersistenceShape,
} from '@/features/import/services/canonical-event-persistence-payload';


function fixtureByKey(key: string) {
  const fixture = GOLDEN_REFERENCE_IMPORT_FIXTURES.find((entry) => entry.key === key);
  if (!fixture) {
    throw new Error(`Missing fixture: ${key}`);
  }
  return fixture;
}

function roundtripFromFixture(key: string) {
  const fixture = fixtureByKey(key);
  const build = buildCanonicalEventFromVerifiedPublicEvidence({
    officialEvidence: fixture.officialEvidence,
    ticketEvidence: fixture.ticketEvidence,
    checkoutEvidence: fixture.checkoutEvidence,
    conflictingTicketEvidence: fixture.conflictingTicketEvidence,
  });
  const payload = buildCanonicalEventPersistencePayload(build);
  const rowShape = toEventRowPersistenceShape(payload);
  const domainEvent = mapPersistenceReadbackToDomainEvent({
    id: `evt-roundtrip-${key}`,
    title: build.canonicalPatch.title ?? fixture.label,
    startDate: build.canonicalPatch.startDate ?? fixture.officialEvidence?.eventDate ?? '',
    payload,
    ticketUrl: build.canonicalPatch.ticketUrl,
    priceText: build.canonicalPatch.priceText,
    venueName: build.canonicalPatch.venueName,
    venueCity: build.canonicalPatch.venueCity,
    websiteUrl: build.canonicalPatch.websiteUrl,
  });
  const display = toEventDisplayModel(domainEvent);
  return { fixture, build, payload, rowShape, domainEvent, display };
}

describe('canonical event vertical slice roundtrip', () => {
  it('1. writer and consumer use the same description field (events.description)', () => {
    const { payload, rowShape, display } = roundtripFromFixture('r3hab');
    expect(rowShape.description).toBe(payload.eventPatch.description);
    expect(display.description).toBe(payload.eventPatch.description);
    expect(display.sanitizedDescription).toContain('September 4th');
  });

  it('2. one structured lineup row renders as one billing row', () => {
    const { display } = roundtripFromFixture('r3hab');
    const lineupVm = toLineupSectionViewModel(display, { artistsById: new Map() });
    expect(lineupVm?.billingRows?.length).toBe(5);
    expect(lineupVm?.billingRows?.every((row) => row.artists.length === 1)).toBe(true);
  });

  it('3. compound acts are not split in persistence or consumer readback', () => {
    const loonyland = buildCanonicalEventFromVerifiedPublicEvidence({
      officialEvidence: {
        pageUrl: 'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie',
        pageTitle: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
        eventDate: '2026-08-21T22:00:00',
        venueName: 'Bootshaus',
        venueCity: 'Köln',
        description:
          "Let's go Loony... We're back on the MAINFLOOR.On August 21st, LOONYLAND returns to Bootshaus with LUCA DANTE SPADAFORA, 2 ENGEL & CHARLIE and more.MAINFLOOR:LUCA DANTE SPADAFORA 2 ENGEL & CHARLIEOLIVER MAGENTADJ OLDEJEY AUX PLATINES",
        lineupContentBlocks: [
          "MAINFLOOR:LUCA DANTE SPADAFORA 2 ENGEL & CHARLIEOLIVER MAGENTADJ OLDEJEY AUX PLATINES",
        ],
        verifiedAt: '2026-08-13T00:00:00.000Z',
      },
    });
    const payload = buildCanonicalEventPersistencePayload(loonyland);
    const billing = payload.structuredLineupEntries.map((entry) => entry.artists[0]);
    expect(billing).toContain('2 ENGEL & CHARLIE');
    expect(billing).not.toContain('2 ENGEL');
    expect(billing).not.toContain('CHARLIE');

    const event = mapPersistenceReadbackToDomainEvent({
      id: 'evt-loonyland-roundtrip',
      title: loonyland.canonicalPatch.title ?? 'LOONYLAND',
      startDate: loonyland.canonicalPatch.startDate ?? '2026-08-21T20:00:00+00:00',
      payload,
      venueName: 'Bootshaus',
      venueCity: 'Köln',
    });
    const labels = lineupBillingLabelsFromDomainEvent(event);
    expect(labels).toHaveLength(5);
    expect(labels.filter((name) => name.includes('ENGEL')).length).toBe(1);
    expect(labels).toContain('2 ENGEL & CHARLIE');
  });

  it('4. writer and consumer use the same genre form (events.genre_labels)', () => {
    const { payload, rowShape, domainEvent } = roundtripFromFixture('r3hab');
    expect(rowShape.genre_labels).toEqual(payload.eventPatch.genreLabels);
    expect(domainEvent.genres).toEqual(payload.eventPatch.genreLabels);
  });

  it('5. genres reach hero chips via productive display projection', () => {
    const { display } = roundtripFromFixture('r3hab');
    const hero = toEventHeroViewModel(display);
    expect(hero.genreLabels.length).toBeGreaterThan(0);
    expect(hero.genreLabels).toEqual(expect.arrayContaining(['House', 'EDM']));
  });

  it('6. description excludes lineup and footer contamination', () => {
    const { display } = roundtripFromFixture('r3hab');
    const info = toEventInfoViewModel(display);
    const description = info.items.find((item) => item.id === 'description')?.value ?? display.description;
    expect(description).not.toMatch(/bit\.ly/i);
    expect(description).not.toMatch(/OLIVER MAGENTA/i);
  });

  it('7. ticket, venue and date fields stay on canonical patch only', () => {
    const { build, payload } = roundtripFromFixture('r3hab');
    expect(build.canonicalPatch.ticketUrl).toContain('bootshaus-club.ticket.io/C7JPnatZ');
    expect(build.canonicalPatch.venueName).toBe('Bootshaus');
    expect(build.canonicalPatch.startDate).toContain('2026-09-04');
    expect(payload.eventPatch.description).toBeDefined();
    expect((payload.eventPatch as { ticketUrl?: string }).ticketUrl).toBeUndefined();
  });

  it('8. Loonyland local roundtrip: five acts, compound billing, clean description', () => {
    const loonyland = buildCanonicalEventFromVerifiedPublicEvidence({
      officialEvidence: {
        pageUrl: 'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie',
        pageTitle: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
        eventDate: '2026-08-21T22:00:00',
        venueName: 'Bootshaus',
        venueCity: 'Köln',
        description:
          "Let's go Loony... We're back on the MAINFLOOR.On August 21st, LOONYLAND returns to Bootshaus with LUCA DANTE SPADAFORA, 2 ENGEL & CHARLIE and more.MAINFLOOR:LUCA DANTE SPADAFORA 2 ENGEL & CHARLIEOLIVER MAGENTADJ OLDEJEY AUX PLATINES",
        lineupContentBlocks: [
          "MAINFLOOR:LUCA DANTE SPADAFORA 2 ENGEL & CHARLIEOLIVER MAGENTADJ OLDEJEY AUX PLATINES",
        ],
        verifiedAt: '2026-08-13T00:00:00.000Z',
      },
      ticketEvidence: {
        publicTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        listRowTitle: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
        eventDate: '2026-08-21T22:00:00',
        venueName: 'Bootshaus',
        priceText: 'ab 25,90 €',
        verifiedAt: '2026-08-13T00:00:00.000Z',
      },
    });
    const payload = buildCanonicalEventPersistencePayload(loonyland);
    const event = mapPersistenceReadbackToDomainEvent({
      id: 'evt-loonyland-local-roundtrip',
      title: loonyland.canonicalPatch.title ?? 'LOONYLAND',
      startDate: loonyland.canonicalPatch.startDate ?? '2026-08-21T20:00:00+00:00',
      payload,
      ticketUrl: loonyland.canonicalPatch.ticketUrl,
      priceText: loonyland.canonicalPatch.priceText,
      venueName: 'Bootshaus',
      venueCity: 'Köln',
    });
    const display = toEventDisplayModel(event);
    const info = toEventInfoViewModel(display);
    const lineupVm = toLineupSectionViewModel(display, { artistsById: new Map() });
    const renderedDescription =
      info.items.find((item) => item.id === 'description')?.value ?? display.description;
    const renderedLineup =
      lineupVm?.billingRows?.map((row) => row.artists.map((artist) => artist.name).join(' & ')) ?? [];

    expect(renderedDescription).toMatch(/On August 21st, LOONYLAND returns/);
    expect(renderedDescription).not.toMatch(/\bmain\s*floor\b/i);
    expect(renderedLineup).toHaveLength(5);
    expect(renderedLineup).toContain('2 ENGEL & CHARLIE');
    expect(new Set(renderedLineup).size).toBe(5);
  });
});
