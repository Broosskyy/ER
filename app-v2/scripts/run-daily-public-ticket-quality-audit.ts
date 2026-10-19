#!/usr/bin/env tsx
/** Read-only quality audit of every upcoming published public event ticket. */
import { mkdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProductionNotLinked, createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg, verifyLinkedStagingTarget } from '../server/ingestion/sync/linked-db';
import { auditPublicTickets, type PublicTicketAuditRow } from '../server/ingestion/sync/daily-public-ticket-audit';

const SQL = `
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'eventId',e.id, 'title',e.title, 'startsAt',e.starts_at,
  'ticketId',t.id, 'provider',t.provider,
  'priceMinor',t.price_from_minor, 'currency',t.currency,
  'ticketUrl',t.ticket_url, 'salesStatus',t.sales_status
) ORDER BY e.starts_at,e.id),'[]'::jsonb) AS rows
FROM public.events e
LEFT JOIN LATERAL (
  SELECT * FROM public.event_tickets t
  WHERE t.event_id=e.id
  ORDER BY t.sort_order,t.id LIMIT 1
) t ON TRUE
WHERE e.status='published' AND e.starts_at>NOW();
`;

function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  const target = verifyLinkedStagingTarget(cwd);
  const rows = loadJsonAgg<PublicTicketAuditRow>(
    createSupabaseCliLinkedQueryExecutor(cwd), SQL);
  if (!rows.length) throw new Error('daily_public_ticket_audit_empty_result');
  const result = auditPublicTickets(rows);
  const out = join(cwd,'..','artifacts','daily-public-ticket-quality');
  mkdirSync(out,{recursive:true});
  writeFileSync(join(out,'snapshot.json'),
    JSON.stringify({generatedAt:new Date().toISOString(),projectRef:target.ref,
      readOnly:true,summary:result},null,2)+'\n','utf8');
  console.log(JSON.stringify({count:result.upcomingPublishedEvents,
    flags:result.flaggedEvents,countsByConcern:result.countsByConcern,
    readOnly:true},null,2));
}
main();
