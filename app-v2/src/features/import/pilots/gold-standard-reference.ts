export interface GoldStandardReferenceEvent {
  key: string;
  eventId: string;
  label: string;
  platform: 'ticket_io' | 'ticket_kings';
  websiteUrl: string;
  ticketUrl: string;
}

export const GOLD_STANDARD_REFERENCE_EVENTS: GoldStandardReferenceEvent[] = [
  {
    key: 'ship',
    eventId: 'evt-1785339420043-obhyeev',
    label: 'Bootshaus on a Ship Vol. III',
    platform: 'ticket_io',
    websiteUrl: 'https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iii',
    ticketUrl: 'https://bootshaus-club.ticket.io/wUc3uQrR/',
  },
  {
    key: 'levi',
    eventId: 'evt-1785339383539-0lxvjlp',
    label: 'LEVI',
    platform: 'ticket_io',
    websiteUrl: 'https://bootshaus.tv/events/nightswithus-presents-levi',
    ticketUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
  },
  {
    key: 'underland',
    eventId: 'evt-1785389049895-4mb7dub',
    label: 'Underland',
    platform: 'ticket_io',
    websiteUrl: 'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026',
    ticketUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
  },
  {
    key: 'bc173',
    eventId: 'evt-1785339392687-tbdwup4',
    label: 'BC173',
    platform: 'ticket_io',
    websiteUrl: 'https://bootshaus.tv/events/19-9-26-bc173-airport-session-pres-by-bootshaus',
    ticketUrl: 'https://bootshaus-club.ticket.io/fjspvLe4/',
  },
  {
    key: 'sommerfest',
    eventId: 'evt-1785389055557-ux20897',
    label: 'Sommerfest Elektroküche',
    platform: 'ticket_kings',
    websiteUrl: 'https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026',
    ticketUrl: 'https://ticketkings.de/event/sommerfest-elektrokueche-08-08-2026/',
  },
  {
    key: 'mdma',
    eventId: 'evt-1785443911160-owt97y3',
    label: 'MDMA',
    platform: 'ticket_kings',
    websiteUrl: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/',
    ticketUrl: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/',
  },
  {
    key: 'affenkaefig',
    eventId: 'evt-1785339005035-wam829k',
    label: 'Affenkäfig',
    platform: 'ticket_io',
    websiteUrl: 'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln',
    ticketUrl: 'https://bootshaus-club.ticket.io/B3jK8aPC/',
  },
  {
    key: 'proton',
    eventId: 'evt-1785443914377-7g9l545',
    label: 'PROTON Stuttgart',
    platform: 'ticket_kings',
    websiteUrl: 'https://ticketkings.de/event/m-d-m-a-xxx-proton-xxx-stuttgart/',
    ticketUrl: 'https://ticketkings.de/event/m-d-m-a-xxx-proton-xxx-stuttgart/',
  },
];

export const PILOT_IMPORTER_VERSION = 'phase481-pilot-v1';

export const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

/** Captured HTML fixtures for idempotent replay (Phase 4.8.1.1). */
let pilotHtmlFixtures: Map<string, { status: number; finalUrl: string; html: string }> | null = null;

export function setPilotHtmlFixtures(
  fixtures: Record<string, { status: number; finalUrl: string; html: string }>,
): void {
  pilotHtmlFixtures = new Map(Object.entries(fixtures));
}

export function clearPilotHtmlFixtures(): void {
  pilotHtmlFixtures = null;
}

export async function pilotFetchHtml(url: string): Promise<{
  status: number;
  finalUrl: string;
  html: string;
  error?: string;
}> {
  if (pilotHtmlFixtures?.has(url)) {
    const f = pilotHtmlFixtures.get(url)!;
    return { status: f.status, finalUrl: f.finalUrl, html: f.html };
  }
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
    return { status: response.status, finalUrl: response.url, html: await response.text() };
  } catch (error) {
    return {
      status: 0,
      finalUrl: url,
      html: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
