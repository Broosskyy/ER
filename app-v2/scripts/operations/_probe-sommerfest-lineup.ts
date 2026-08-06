import { parseTicketKingsDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-detail-parser';
import { parseTicketKingsEventDetailHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter';

const TK_URL = 'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/';
const AF_URL = 'https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026/';

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function main(): Promise<void> {
  const tkHtml = await fetchHtml(TK_URL);
  const tkParsed = parseTicketKingsDetailHtml(tkHtml);
  const tkEvent = parseTicketKingsEventDetailHtml(tkHtml, {
    platform: 'ticket_king',
    shopSlug: 'ticketkings',
    listUrl: 'https://ticketkings.de/all-events/',
    timezone: 'Europe/Berlin',
  });

  const lineupIdx = tkHtml.search(/line\s*up/i);
  console.log('=== Ticket Kings detail ===');
  console.log('lineup snippet', tkHtml.slice(lineupIdx, lineupIdx + 800));
  console.log('artistCount', tkParsed.artistNames?.length);
  console.log('artists', tkParsed.artistNames);
  console.log('lineupEntries', tkParsed.lineupEntries?.length);
  console.log('event artists', tkEvent?.artistNames?.length);
  console.log('genres', tkParsed.genreNames);
  console.log('floor', tkParsed.floorCount);
  console.log('env', tkParsed.venueEnvironment);
  console.log('coverage', tkParsed.fieldCoverage);

  const afHtml = await fetchHtml(AF_URL);
  const lineupIdxAf = afHtml.search(/line\s*up|ASL|ANNX/i);
  console.log('=== Affenkäfig detail ===');
  console.log('html length', afHtml.length);
  console.log('lineup snippet', afHtml.slice(lineupIdxAf, lineupIdxAf + 1200));
}

main().catch(console.error);
