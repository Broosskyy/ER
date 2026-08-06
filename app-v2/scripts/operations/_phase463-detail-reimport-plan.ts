/**
 * Read-only production reimport plan for Phase 4.6.3 Part 3.
 * Does NOT mutate production.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT = join(
  process.cwd(),
  'docs/real-data/_phase463_detail_reimport_plan.json',
);

const plan = {
  generatedAt: new Date().toISOString(),
  mode: 'read_only_plan',
  approvalRequired: true,
  recommendedPasses: [
    {
      pass: 1,
      action: 'list_fetch',
      description: 'Refresh list pages for all managed ticket.io and ticket_king enrichment sources.',
    },
    {
      pass: 2,
      action: 'detail_fetch',
      description:
        'Fetch detail pages up to maxDetailPages per source; persist snapshots in import record metadata.',
    },
    {
      pass: 3,
      action: 'republish',
      description:
        'Republish through shared pipeline; rebuild lineups, genres, ticket phases, structured attributes.',
    },
  ],
  affectedSourceIds: [
    'source-bootshaus-ticket-io',
    'source-affenkaefig-ticket-kings',
    'source-ticket-io-protontheclub',
    'source-ticket-io-lehmannclub',
    'source-ticket-io-area51events',
    'source-ticket-io-technodampfer',
    'source-ticket-io-hmg-concerts',
    'source-bootshaus-koeln',
    'source-affenkaefig',
  ],
  expectedUpdates: {
    lineups: 'Events with TK/HTML lineups or recovered Ticket.io detail performers',
    ticketPhases: 'Events with multi-offer JSON-LD on accessible detail pages',
    genres: 'Ticket Kings labeled genre fields + list GENRE rows',
    attributes: 'Indoor/outdoor, floor count, minimum age from detail HTML',
  },
  risks: [
    'Ticket.io PoW may block detail fetch — prior snapshots must be retained',
    'Artist alias conflicts on B2B combined display names',
    'Duplicate events across complementary origins — merge by field quality only',
  ],
  idempotency: 'Run pass 2 twice; canonical counts must stabilize (createdCount=0).',
};

writeFileSync(OUTPUT, JSON.stringify(plan, null, 2));
console.log(`Wrote ${OUTPUT}`);
