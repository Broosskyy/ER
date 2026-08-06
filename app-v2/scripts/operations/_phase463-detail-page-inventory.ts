/**
 * Read-only detail-page inventory for Phase 4.6.3 Part 3.
 * Does not mutate production data.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PRODUCTION_CONNECTOR_SOURCE_IDS } from '@/features/aggregation/connectors/framework/detail-extraction/connector-field-coverage';

const OUTPUT = join(
  process.cwd(),
  'docs/real-data/_phase463_detail_page_inventory.json',
);

const SOURCE_NOTES: Record<string, string> = {
  'source-bootshaus-koeln': 'Website level 2–3; list + detail HTML; editorial description and imagery',
  'source-bootshaus-ticket-io': 'Ticket.io enrichment; detail fetch max 15; PoW risk in production',
  'source-affenkaefig': 'Website JSON-LD level 3',
  'source-affenkaefig-ticket-kings': 'Ticket Kings enrichment; detail HTML lineup/genres (when enabled)',
  'source-ticket-io-protontheclub': 'Ticket.io publish; SHOCKONE regression target',
  'source-ticket-io-lehmannclub': 'Ticket.io publish',
  'source-ticket-io-area51events': 'Ticket.io publish',
  'source-ticket-io-technodampfer': 'Ticket.io publish',
  'source-ticket-io-hmg-concerts': 'Ticket.io publish',
};

const report = {
  generatedAt: new Date().toISOString(),
  mode: 'read_only_inventory',
  sources: PRODUCTION_CONNECTOR_SOURCE_IDS.map((sourceId) => ({
    sourceId,
    notes: SOURCE_NOTES[sourceId] ?? 'See connector-field-coverage profile',
  })),
  extractionTargets: [
    'description',
    'lineupEntries',
    'ticketOffers',
    'genreNames',
    'eventAttributes',
    'timetableSlots',
    'minimumAge',
    'doorsOpenAt',
  ],
  limitations: [
    'Ticket.io PoW may block live detail HTML — retain last valid snapshot',
    'No login bypass or anti-bot circumvention',
    'Timetable extraction requires structured evidence — not implemented for all sources yet',
  ],
};

writeFileSync(OUTPUT, JSON.stringify(report, null, 2));
console.log(`Wrote ${OUTPUT}`);
