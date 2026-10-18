#!/usr/bin/env tsx
/** Read-only staging-only current Rausgegangen completeness scope. No DB writes. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertProductionNotLinked, createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg, verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import {
  buildLiveRausgegangenScope, type LiveScopeRow,
} from '../server/official-connectors/rausgegangen-discovery/live-completeness-scope';

/** Single SELECT, no raw_payload, no user data, no production access. */
export const LIVE_SCOPE_SQL = `
WITH consumer_events AS (
 SELECT e.id,e.title,e.description,e.starts_at,e.ends_at,e.timezone,e.organizer_name,
        v.name AS venue_name,v.city
 FROM public.events e
 LEFT JOIN public.venues v ON v.id=e.venue_id
 WHERE e.status='published' AND e.published_at IS NOT NULL
   AND COALESCE(e.ends_at,e.starts_at+interval '18 hours')>NOW()
   AND EXISTS (
     SELECT 1 FROM public.event_sources s
     WHERE s.event_id=e.id
       AND s.source_url ~* '^https?://(www[.])?rausgegangen[.]de/events/'
   )
), snapshot AS (
 SELECT e.*, source.id AS source_id,source.source_url,
 COALESCE((SELECT COUNT(*) FROM public.event_lineup l WHERE l.event_id=e.id),0) AS lineup_count,
 ticket.id AS ticket_id,ticket.provider,ticket.ticket_url,ticket.price_from_minor,
 ticket.currency,ticket.sales_status,ticket.sort_order
 FROM consumer_events e
 CROSS JOIN LATERAL (
   SELECT s.id,s.source_url FROM public.event_sources s
   WHERE s.event_id=e.id AND s.source_url ~* '^https?://(www[.])?rausgegangen[.]de/events/'
   ORDER BY CASE WHEN s.source_role='official' THEN 0 ELSE 1 END,s.id LIMIT 1
 ) source
 LEFT JOIN LATERAL (
   SELECT * FROM public.event_tickets t WHERE t.event_id=e.id
   ORDER BY CASE WHEN t.sort_order=0 THEN 0 ELSE 1 END,t.sort_order,t.id LIMIT 1
 ) ticket ON true
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
 'eventId',id,'sourceId',source_id,'sourceUrl',source_url,'title',title,
 'startsAt',starts_at,'endsAt',ends_at,'timezone',timezone,'venueName',venue_name,
 'city',city,'organizerName',organizer_name,'currentLineupCount',lineup_count,
 'hasDescription',NULLIF(BTRIM(description),'') IS NOT NULL,
 'currentTicket',CASE WHEN ticket_id IS NULL THEN NULL ELSE jsonb_build_object(
   'ticketId',ticket_id,'provider',provider,'ticketUrl',ticket_url,
   'priceFromMinor',price_from_minor,'currency',currency,
   'salesStatus',sales_status,'sortOrder',sort_order) END
) ORDER BY starts_at,id),'[]'::jsonb) AS rows FROM snapshot;
`;

function main(): void {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  const linked = verifyLinkedStagingTarget(cwd);
  const rows = loadJsonAgg<LiveScopeRow>(createSupabaseCliLinkedQueryExecutor(cwd), LIVE_SCOPE_SQL);
  const {manifest,audit} = buildLiveRausgegangenScope(rows, linked.ref);
  const out = join(cwd,'..','artifacts','event-enrichment-completeness');
  mkdirSync(out,{recursive:true});
  writeFileSync(join(out,'live-scope.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
  writeFileSync(join(out,'live-scope-audit.json'),JSON.stringify(audit,null,2)+'\n','utf8');
  console.log(JSON.stringify({scope:join(out,'live-scope.json'),
    count:manifest.count,missingTicketRows:audit.missingTicketRows,
    missingLineups:audit.missingLineups,missingDescriptions:audit.missingDescriptions,
    readOnly:true},null,2));
}
main();
