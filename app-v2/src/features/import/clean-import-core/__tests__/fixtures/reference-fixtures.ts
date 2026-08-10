import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import type { ConnectorOutput } from '@/features/import/clean-import-core/event-evidence';

const VERIFIED_AT = '2026-08-10T18:00:00.000Z';
const VENUE = 'Reference Club';

function lineup(names: string[]): LineupEvidenceEntry[] {
  return names.map((displayName, sortOrder) => ({
    sortOrder,
    displayName,
    rawSourceSpelling: displayName,
    normalizedName: displayName.toLowerCase(),
    billingRelation: 'SOLO',
    isB2b: false,
    isF2f: false,
    isLiveSet: false,
    confidence: 0.95,
    reviewState: 'accepted',
    inclusionReason: 'offline_fixture',
  }));
}

function official(
  key: string,
  title: string,
  startDate: string,
  artists: string[],
  ticketUrl: string,
): ConnectorOutput {
  return {
    sourceId: `${key}-official`,
    sourceFamily: 'official_website',
    sourceUrl: `https://official.example/events/${key}`,
    verifiedAt: VERIFIED_AT,
    title,
    startDate,
    venueName: VENUE,
    officialWebsiteUrl: `https://official.example/events/${key}`,
    outboundTicketUrls: [ticketUrl],
    description: `${title} official event description`,
    lineup: lineup(artists),
    lineupState: artists.length ? 'explicit_artists' : 'empty',
  };
}

function ticket(
  key: string,
  family: 'ticket_io' | 'ticket_kings',
  title: string,
  startDate: string,
  amount: number,
): ConnectorOutput {
  const host = family === 'ticket_io' ? 'reference.ticket.io' : 'ticketkings.de';
  const path = family === 'ticket_io' ? key : `event/${key}`;
  const publicTicketUrl = `https://${host}/${path}/`;
  return {
    sourceId: `${key}-${family}`,
    sourceFamily: family,
    sourceUrl: publicTicketUrl,
    verifiedAt: VERIFIED_AT,
    title,
    startDate,
    venueName: VENUE,
    publicTicketUrl,
    admissionPrice: {
      amount,
      currency: 'EUR',
      text: `${amount.toFixed(2)} EUR`,
    },
    ticketPhases: [
      {
        id: `${key}-regular`,
        name: 'Regular',
        sortOrder: 400,
        kind: 'regular',
        priceAmount: amount,
        priceCurrency: 'EUR',
        available: true,
        soldOut: false,
        purchaseUrl: publicTicketUrl,
      },
    ],
    ticketStatus: 'on_sale',
  };
}

export interface ReferenceFixture {
  name: string;
  outputs: ConnectorOutput[];
}

export const REFERENCE_FIXTURES: ReferenceFixture[] = [
  {
    name: 'LEVI',
    outputs: [
      official('levi', 'Nights With Us presents LEVI', '2026-09-12T22:00:00+02:00', ['LEVI'], 'https://reference.ticket.io/levi/'),
      ticket('levi', 'ticket_io', 'Nights With Us presents LEVI', '2026-09-12T22:00:00+02:00', 24),
    ],
  },
  {
    name: 'BC173',
    outputs: [
      official('bc173', 'BC173 Airport Session', '2026-09-19T20:00:00+02:00', ['BC173'], 'https://reference.ticket.io/bc173/'),
      ticket('bc173', 'ticket_io', 'BC173 Airport Session', '2026-09-19T20:00:00+02:00', 29),
    ],
  },
  {
    name: 'R3HAB',
    outputs: [
      official('r3hab', 'R3HAB', '2026-10-02T23:00:00+02:00', ['R3HAB'], 'https://reference.ticket.io/r3hab/'),
      ticket('r3hab', 'ticket_io', 'R3HAB', '2026-10-02T23:00:00+02:00', 35),
    ],
  },
  {
    name: 'Bootshaus Sommerfest',
    outputs: [
      official('bootshaus-sommerfest', 'Bootshaus Sommerfest', '2026-08-22T14:00:00+02:00', ['Artist One'], 'https://reference.ticket.io/bootshaus-sommerfest/'),
      ticket('bootshaus-sommerfest', 'ticket_io', 'Bootshaus Sommerfest', '2026-08-22T14:00:00+02:00', 18),
    ],
  },
  {
    name: 'Underland',
    outputs: [
      official('underland', 'Underland', '2026-10-03T23:00:00+02:00', ['Underland Resident'], 'https://reference.ticket.io/underland/'),
      ticket('underland', 'ticket_io', 'Underland', '2026-10-03T23:00:00+02:00', 22),
    ],
  },
  {
    name: 'Sommerfest Elektroküche',
    outputs: [
      official('sommerfest-elektrokueche', 'Sommerfest Elektroküche', '2026-08-29T14:00:00+02:00', ['DJ Alpha', 'DJ Beta'], 'https://ticketkings.de/event/sommerfest-elektrokueche/'),
      ticket('sommerfest-elektrokueche', 'ticket_kings', 'Sommerfest Elektroküche', '2026-08-29T14:00:00+02:00', 20),
    ],
  },
  {
    name: 'MDMA/CHROME conflict',
    outputs: [
      official('mdma', 'MDMA - Musik Die Mich Antreibt', '2026-10-10T22:00:00+02:00', ['MDMA Resident'], 'https://ticketkings.de/event/mdma-musik/'),
      ticket('mdma-musik', 'ticket_kings', 'MDMA - Musik Die Mich Antreibt', '2026-10-10T22:00:00+02:00', 19),
      {
        ...ticket('chrome', 'ticket_io', 'CHROME COLOGNE', '2026-10-09T22:00:00+02:00', 27),
        venueName: 'Different Venue',
      },
    ],
  },
];
