import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

import {
  BULK_REBUILD_ACCEPTANCE_FIXTURES,
  type BulkAcceptanceFixtureKey,
} from './acceptance-fixtures';
import { buildBulkRebuildEvidenceBundle } from './bulk-evidence-bundle';
import type { SourceEvidenceContribution } from './types';

const FIXTURE_VERIFIED_AT = '2026-01-15T12:00:00.000Z';

function ticketOffer(
  name: string,
  priceAmount: number,
  priceLabel: string,
  purchaseUrl: string,
) {
  return {
    name,
    priceAmount,
    priceCurrency: 'EUR',
    priceLabel,
    purchaseUrl,
    admission: true,
  };
}

function structuredLineup(names: string[]) {
  return names.map((name, index) => ({
    sortOrder: index,
    displayName: name,
    rawSourceSpelling: name,
    normalizedName: name,
    billingRelation: 'SOLO' as const,
    isB2b: false,
    isF2f: false,
    isLiveSet: false,
    confidence: 0.9,
    reviewState: 'accepted' as const,
    inclusionReason: 'fixture_structured_lineup',
  }));
}

function mkCandidate(
  overrides: Partial<CanonicalImportEvent> & Pick<CanonicalImportEvent, 'externalId' | 'title' | 'startDate'>,
): CanonicalImportEvent {
  return {
    sourceId: overrides.sourceId ?? 'src-fixture',
    sourceName: overrides.sourceName ?? 'Fixture Source',
    rawSourceType: 'unknown',
    ...overrides,
  };
}

function mkContribution(
  candidate: CanonicalImportEvent,
  options: {
    identityVerdict?: SourceEvidenceContribution['identityVerdict'];
    identityReason?: string;
    mappedEventId?: string;
  } = {},
): SourceEvidenceContribution {
  const bundle = buildBulkRebuildEvidenceBundle(candidate);
  return {
    sourceId: candidate.sourceId,
    sourceName: candidate.sourceName,
    externalId: candidate.externalId,
    candidate,
    bundle,
    identityVerdict: options.identityVerdict ?? 'exact',
    identityReason: options.identityReason ?? 'fixture_exact',
    verifiedAt: FIXTURE_VERIFIED_AT,
    mappedEventId: options.mappedEventId,
    mappingMethod: options.mappedEventId ? 'import_record' : 'unmapped',
  };
}

export function buildFixtureExistingRecord(eventId: string): AdminEventRecord | undefined {
  const fixture = BULK_REBUILD_ACCEPTANCE_FIXTURES.find((entry) => entry.eventId === eventId);
  if (!fixture) return undefined;

  const base: AdminEventRecord = {
    id: eventId,
    title: fixture.titleFragment,
    description: '',
    startDate: '2026-09-01T20:00:00.000Z',
    status: 'published',
    createdAt: FIXTURE_VERIFIED_AT,
    updatedAt: FIXTURE_VERIFIED_AT,
  };

  switch (fixture.key) {
    case 'LEVI':
      return {
        ...base,
        title: 'LEVI pres. by BOOTSHAUS',
        startDate: '2025-05-30T22:00:00.000Z',
        endDate: '2025-05-31T06:00:00.000Z',
        venueName: 'Bootshaus',
        genreLabels: ['HOUSE'],
      };
    case 'BC173':
      return {
        ...base,
        title: 'Bootshaus pres. BC173 (let\'s get loco)',
        venueName: 'Moxy Cologne',
        organizerName: 'Bootshaus',
        venueAddress: 'Moxy Cologne City Center',
      };
    case 'R3HAB':
      return {
        ...base,
        title: 'R3HAB pres. by BOOTSHAUS',
        startDate: '2026-09-04T22:00:00.000Z',
        venueName: 'Bootshaus',
      };
    case 'BOOTSHAUS_SOMMERFEST':
      return {
        ...base,
        title: 'Bootshaus Sommerfest',
        venueName: 'Bootshaus',
      };
    case 'UNDERLAND':
      return {
        ...base,
        title: 'Underland Essigfabrik 05.09.2026',
        startDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Essigfabrik',
      };
    case 'SOMMERFEST_ELEKTROKUECHE':
      return {
        ...base,
        title: 'Sommerfest Elektroküche',
        venueName: 'Essigfabrik / Elektroküche',
      };
    case 'MDMA':
      return {
        ...base,
        title: 'MDMA - Musik Die Mich Antreibt',
        startDate: '2026-10-10T20:00:00.000Z',
        venueName: 'Essigfabrik',
      };
    default:
      return base;
  }
}

function buildLeviContributions(eventId: string): SourceEvidenceContribution[] {
  const official = mkCandidate({
    externalId: 'levi-official',
    sourceId: 'src-website',
    sourceName: 'Bootshaus Website',
    title: 'LEVI pres. by BOOTSHAUS',
    startDate: '2025-05-30T22:00:00.000Z',
    endDate: '2025-05-31T06:00:00.000Z',
    venueName: 'Bootshaus',
    genreNames: ['HOUSE'],
    eventUrl: 'https://bootshaus.de/event/levi',
    description: 'LEVI night at Bootshaus. Genre: HOUSE.',
    sourceMetadata: {
      connector: 'website',
      connectorKey: 'website',
      officialGenres: ['HOUSE'],
      officialDescription: 'LEVI night at Bootshaus. Genre: HOUSE.',
      verifiedAt: FIXTURE_VERIFIED_AT,
      pageTitle: 'LEVI pres. by BOOTSHAUS',
      eventDate: '2025-05-30',
      venueName: 'Bootshaus',
    },
  });
  return [mkContribution(official, { mappedEventId: eventId })];
}

function buildBc173Contributions(eventId: string): SourceEvidenceContribution[] {
  const official = mkCandidate({
    externalId: 'bc173-official',
    sourceId: 'src-website',
    sourceName: 'Bootshaus Website',
    title: 'Bootshaus pres. BC173 (let\'s get loco)',
    startDate: '2026-08-15T22:00:00.000Z',
    venueName: 'Moxy Cologne',
    organizerName: 'Bootshaus',
    venueAddress: 'Moxy Cologne City Center',
    eventUrl: 'https://bootshaus.de/event/bc173',
    description:
      'LINEUP\nFAST BOY\nDHALI\nLIONKAY\nONINE\n\nPublic Transport Info follows below.',
    sourceMetadata: {
      connector: 'website',
      connectorKey: 'website',
      officialDescription:
        'LINEUP\nFAST BOY\nDHALI\nLIONKAY\nONINE\n\nPublic Transport Info follows below.',
      structuredLineup: structuredLineup(['FAST BOY', 'DHALI', 'LIONKAY', 'ONINE']),
      verifiedAt: FIXTURE_VERIFIED_AT,
      pageTitle: 'Bootshaus pres. BC173 (let\'s get loco)',
      eventDate: '2026-08-15',
      venueName: 'Moxy Cologne',
    },
  });

  const ticket = mkCandidate({
    externalId: 'bc173-ticket',
    sourceId: 'src-ticket-io',
    sourceName: 'Ticket.io',
    title: 'Bootshaus pres. BC173 (let\'s get loco)',
    startDate: '2026-08-15T22:00:00.000Z',
    venueName: 'Moxy Cologne',
    ticketUrl: 'https://bootshaus.ticket.io/9abc-bc173/',
    eventUrl: 'https://bootshaus.ticket.io/9abc-bc173/',
    priceText: '26,00 €',
    sourceMetadata: {
      connectorKey: 'ticket_platform',
      platform: 'ticket_io',
      shopSlug: 'bootshaus',
      verifiedAt: FIXTURE_VERIFIED_AT,
      listRowTitle: 'Bootshaus pres. BC173 (let\'s get loco)',
      eventDate: '2026-08-15',
      venueName: 'Moxy Cologne',
      ticketOffers: [ticketOffer('Admission', 26, '26,00 €', 'https://bootshaus.ticket.io/9abc-bc173/')],
      connectorPriceText: '26,00 €',
      priceText: '26,00 €',
    },
  });

  return [
    mkContribution(official, { mappedEventId: eventId }),
    mkContribution(ticket, { mappedEventId: eventId }),
  ];
}

function buildR3habContributions(eventId: string): SourceEvidenceContribution[] {
  const official = mkCandidate({
    externalId: 'r3hab-official',
    sourceId: 'src-website',
    sourceName: 'Bootshaus Website',
    title: 'R3HAB pres. by BOOTSHAUS',
    startDate: '2026-09-04T22:00:00.000Z',
    venueName: 'Bootshaus',
    eventUrl: 'https://bootshaus.de/event/r3hab',
    description:
      'MAINFLOOR:\nR3HAB\nLA FUENTE\nOLIVER MAGENTA\nRELOVA\nDAVE REPLAY',
    sourceMetadata: {
      connector: 'website',
      connectorKey: 'website',
      officialDescription:
        'MAINFLOOR:\nR3HAB\nLA FUENTE\nOLIVER MAGENTA\nRELOVA\nDAVE REPLAY',
      structuredLineup: structuredLineup([
        'R3HAB',
        'LA FUENTE',
        'OLIVER MAGENTA',
        'RELOVA',
        'DAVE REPLAY',
      ]),
      verifiedAt: FIXTURE_VERIFIED_AT,
      pageTitle: 'R3HAB pres. by BOOTSHAUS',
      eventDate: '2026-09-04',
      venueName: 'Bootshaus',
    },
  });

  const ticket = mkCandidate({
    externalId: 'r3hab-ticket',
    sourceId: 'src-ticket-io',
    sourceName: 'Ticket.io',
    title: 'R3HAB pres. by BOOTSHAUS',
    startDate: '2026-09-04T22:00:00.000Z',
    venueName: 'Bootshaus',
    ticketUrl: 'https://bootshaus.ticket.io/r3hab-event/',
    eventUrl: 'https://bootshaus.ticket.io/r3hab-event/',
    sourceMetadata: {
      connectorKey: 'ticket_platform',
      platform: 'ticket_io',
      shopSlug: 'bootshaus',
      verifiedAt: FIXTURE_VERIFIED_AT,
      listRowTitle: 'R3HAB pres. by BOOTSHAUS',
      eventDate: '2026-09-04',
      venueName: 'Bootshaus',
      ticketOffers: [ticketOffer('Admission', 23.9, '23,90 €', 'https://bootshaus.ticket.io/r3hab-event/')],
      connectorPriceText: '23,90 €',
      priceText: '23,90 €',
    },
  });

  return [
    mkContribution(official, { mappedEventId: eventId }),
    mkContribution(ticket, { mappedEventId: eventId }),
  ];
}

function buildBootshausSommerfestContributions(eventId: string): SourceEvidenceContribution[] {
  const official = mkCandidate({
    externalId: 'sommerfest-official',
    sourceId: 'src-website',
    sourceName: 'Bootshaus Website',
    title: 'Bootshaus Sommerfest',
    startDate: '2026-07-12T14:00:00.000Z',
    venueName: 'Bootshaus',
    genreNames: ['Techno', 'House', 'Trance', 'Electro', 'Minimal', 'Deep House'],
    eventUrl: 'https://bootshaus.de/event/sommerfest',
    sourceMetadata: {
      connector: 'website',
      connectorKey: 'website',
      officialGenres: ['Techno', 'House', 'Trance', 'Electro', 'Minimal', 'Deep House'],
      verifiedAt: FIXTURE_VERIFIED_AT,
      pageTitle: 'Bootshaus Sommerfest',
      eventDate: '2026-07-12',
      venueName: 'Bootshaus',
    },
  });

  const ticket = mkCandidate({
    externalId: 'sommerfest-ticket',
    sourceId: 'src-ticket-kings',
    sourceName: 'TicketKings',
    title: 'Bootshaus Sommerfest',
    startDate: '2026-07-12T14:00:00.000Z',
    venueName: 'Bootshaus',
    ticketUrl: 'https://ticketkings.de/event/bootshaus-sommerfest',
    eventUrl: 'https://ticketkings.de/event/bootshaus-sommerfest',
    sourceMetadata: {
      connectorKey: 'ticket_platform',
      platform: 'ticket_kings',
      verifiedAt: FIXTURE_VERIFIED_AT,
      listRowTitle: 'Bootshaus Sommerfest',
      eventDate: '2026-07-12',
      venueName: 'Bootshaus',
      ticketOffers: [ticketOffer('Admission', 11.9, '11,90 €', 'https://ticketkings.de/event/bootshaus-sommerfest')],
      connectorPriceText: '11,90 €',
      priceText: '11,90 €',
      publicCtaCandidateUrl: 'https://ticketkings.de/event/bootshaus-sommerfest',
    },
  });

  return [
    mkContribution(official, { mappedEventId: eventId }),
    mkContribution(ticket, { mappedEventId: eventId }),
  ];
}

function buildUnderlandContributions(eventId: string): SourceEvidenceContribution[] {
  const official = mkCandidate({
    externalId: 'underland-official',
    sourceId: 'src-website',
    sourceName: 'Essigfabrik Website',
    title: 'Underland Essigfabrik 05.09.2026',
    startDate: '2026-09-05T20:00:00.000Z',
    venueName: 'Essigfabrik',
    genreNames: ['Hardtechno'],
    eventUrl: 'https://essigfabrik.de/event/underland',
    sourceMetadata: {
      connector: 'website',
      connectorKey: 'website',
      officialGenres: ['Hardtechno'],
      verifiedAt: FIXTURE_VERIFIED_AT,
      pageTitle: 'Underland Essigfabrik 05.09.2026',
      eventDate: '2026-09-05',
      venueName: 'Essigfabrik',
    },
  });

  const officialContribution = mkContribution(official, { mappedEventId: eventId });
  officialContribution.bundle = {
    ...officialContribution.bundle,
    content: {
      ...officialContribution.bundle.content,
      genreLabels: ['Hardtechno'],
    },
  };

  const ticket = mkCandidate({
    externalId: 'underland-ticket',
    sourceId: 'src-ticket-kings',
    sourceName: 'TicketKings',
    title: 'Underland Essigfabrik 05.09.2026',
    startDate: '2026-09-05T20:00:00.000Z',
    venueName: 'Essigfabrik',
    ticketUrl: 'https://ticketkings.de/event/underland-essigfabrik',
    eventUrl: 'https://ticketkings.de/event/underland-essigfabrik',
    sourceMetadata: {
      connectorKey: 'ticket_platform',
      platform: 'ticket_kings',
      verifiedAt: FIXTURE_VERIFIED_AT,
      listRowTitle: 'Underland Essigfabrik 05.09.2026',
      eventDate: '2026-09-05',
      venueName: 'Essigfabrik',
      ticketOffers: [ticketOffer('Admission', 15, '15,00 €', 'https://ticketkings.de/event/underland-essigfabrik')],
      connectorPriceText: '15,00 €',
      priceText: '15,00 €',
      publicCtaCandidateUrl: 'https://ticketkings.de/event/underland-essigfabrik',
    },
  });

  return [
    officialContribution,
    mkContribution(ticket, { mappedEventId: eventId }),
  ];
}

function buildSommerfestElektrokuecheContributions(eventId: string): SourceEvidenceContribution[] {
  const artists = [
    'DJ Alpha',
    'DJ Beta',
    'DJ Gamma',
    'DJ Delta',
    'DJ Epsilon',
    'DJ Zeta',
    'DJ Eta',
    'DJ Theta',
    'DJ Iota',
    'DJ Kappa',
    'DJ Lambda',
    'DJ Mu',
    'DJ Nu',
    'DJ Xi',
  ];

  const official = mkCandidate({
    externalId: 'elektrokueche-official',
    sourceId: 'src-website',
    sourceName: 'Essigfabrik Website',
    title: 'Sommerfest Elektroküche',
    startDate: '2026-08-22T16:00:00.000Z',
    venueName: 'Essigfabrik / Elektroküche',
    genreNames: ['Techno'],
    eventUrl: 'https://essigfabrik.de/event/sommerfest-elektrokueche',
    sourceMetadata: {
      connector: 'website',
      connectorKey: 'website',
      officialGenres: ['Techno'],
      structuredLineup: structuredLineup(artists),
      verifiedAt: FIXTURE_VERIFIED_AT,
      pageTitle: 'Sommerfest Elektroküche',
      eventDate: '2026-08-22',
      venueName: 'Essigfabrik / Elektroküche',
    },
  });

  const ticket = mkCandidate({
    externalId: 'elektrokueche-ticket',
    sourceId: 'src-ticket-kings',
    sourceName: 'TicketKings',
    title: 'Sommerfest Elektroküche',
    startDate: '2026-08-22T16:00:00.000Z',
    venueName: 'Essigfabrik / Elektroküche',
    ticketUrl: 'https://ticketkings.de/event/sommerfest-elektrokueche',
    eventUrl: 'https://ticketkings.de/event/sommerfest-elektrokueche',
    sourceMetadata: {
      connectorKey: 'ticket_platform',
      platform: 'ticket_kings',
      verifiedAt: FIXTURE_VERIFIED_AT,
      listRowTitle: 'Sommerfest Elektroküche',
      eventDate: '2026-08-22',
      venueName: 'Essigfabrik / Elektroküche',
      ticketOffers: [ticketOffer('Admission', 20, '20,00 €', 'https://ticketkings.de/event/sommerfest-elektrokueche')],
      connectorPriceText: '20,00 €',
      priceText: '20,00 €',
      publicCtaCandidateUrl: 'https://ticketkings.de/event/sommerfest-elektrokueche',
    },
  });

  return [
    mkContribution(official, { mappedEventId: eventId }),
    mkContribution(ticket, { mappedEventId: eventId }),
  ];
}

function buildMdmaContributions(eventId: string): SourceEvidenceContribution[] {
  const official = mkCandidate({
    externalId: 'mdma-official',
    sourceId: 'src-website',
    sourceName: 'Essigfabrik Website',
    title: 'MDMA - Musik Die Mich Antreibt',
    startDate: '2026-10-10T20:00:00.000Z',
    venueName: 'Essigfabrik',
    eventUrl: 'https://essigfabrik.de/event/mdma',
    description: 'MDMA at Essigfabrik. Line Up: Folgt noch.',
    sourceMetadata: {
      connector: 'website',
      connectorKey: 'website',
      officialDescription: 'MDMA at Essigfabrik. Line Up: Folgt noch.',
      verifiedAt: FIXTURE_VERIFIED_AT,
      pageTitle: 'MDMA - Musik Die Mich Antreibt',
      eventDate: '2026-10-10',
      venueName: 'Essigfabrik',
    },
  });

  const ticketKings = mkCandidate({
    externalId: 'mdma-ticketkings',
    sourceId: 'src-ticket-kings',
    sourceName: 'TicketKings',
    title: 'MDMA - Musik Die Mich Antreibt',
    startDate: '2026-10-10T20:00:00.000Z',
    venueName: 'Essigfabrik',
    ticketUrl: 'https://ticketkings.de/event/mdma-musik',
    eventUrl: 'https://ticketkings.de/event/mdma-musik',
    sourceMetadata: {
      connectorKey: 'ticket_platform',
      platform: 'ticket_kings',
      verifiedAt: FIXTURE_VERIFIED_AT,
      listRowTitle: 'MDMA - Musik Die Mich Antreibt',
      eventDate: '2026-10-10',
      venueName: 'Essigfabrik',
      ticketOffers: [ticketOffer('Admission', 18, '18,00 €', 'https://ticketkings.de/event/mdma-musik')],
      connectorPriceText: '18,00 €',
      priceText: '18,00 €',
      publicCtaCandidateUrl: 'https://ticketkings.de/event/mdma-musik',
    },
  });

  const chromeStale = mkCandidate({
    externalId: 'chrome-stale-ticket-io',
    sourceId: 'src-ticket-io-chrome',
    sourceName: 'Ticket.io CHROME',
    title: 'CHROME pres. by BOOTSHAUS',
    startDate: '2026-11-01T22:00:00.000Z',
    venueName: 'Bootshaus',
    ticketUrl: 'https://bootshaus.ticket.io/chrome-wrong-event/',
    eventUrl: 'https://bootshaus.ticket.io/chrome-wrong-event/',
    sourceMetadata: {
      connectorKey: 'ticket_platform',
      platform: 'ticket_io',
      shopSlug: 'bootshaus',
      verifiedAt: FIXTURE_VERIFIED_AT,
      listRowTitle: 'CHROME pres. by BOOTSHAUS',
      eventDate: '2026-11-01',
      venueName: 'Bootshaus',
      ticketOffers: [
        ticketOffer('Admission', 25, '25,00 €', 'https://bootshaus.ticket.io/chrome-wrong-event/'),
      ],
    },
  });

  return [
    mkContribution(official, { mappedEventId: eventId }),
    mkContribution(ticketKings, { mappedEventId: eventId }),
    mkContribution(chromeStale, {
      mappedEventId: eventId,
      identityVerdict: 'mismatch',
      identityReason: 'title_core_mismatch_stale_import',
    }),
  ];
}

export function buildFixtureContributions(key: BulkAcceptanceFixtureKey): SourceEvidenceContribution[] {
  const fixture = BULK_REBUILD_ACCEPTANCE_FIXTURES.find((entry) => entry.key === key);
  if (!fixture) return [];

  switch (key) {
    case 'LEVI':
      return buildLeviContributions(fixture.eventId);
    case 'BC173':
      return buildBc173Contributions(fixture.eventId);
    case 'R3HAB':
      return buildR3habContributions(fixture.eventId);
    case 'BOOTSHAUS_SOMMERFEST':
      return buildBootshausSommerfestContributions(fixture.eventId);
    case 'UNDERLAND':
      return buildUnderlandContributions(fixture.eventId);
    case 'SOMMERFEST_ELEKTROKUECHE':
      return buildSommerfestElektrokuecheContributions(fixture.eventId);
    case 'MDMA':
      return buildMdmaContributions(fixture.eventId);
    default:
      return [];
  }
}

export function buildAllFixtureContributions(): SourceEvidenceContribution[] {
  return BULK_REBUILD_ACCEPTANCE_FIXTURES.flatMap((fixture) =>
    buildFixtureContributions(fixture.key),
  );
}
