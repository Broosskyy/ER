#!/usr/bin/env tsx
import { createSupabaseCliLinkedQueryExecutor, verifyLinkedStagingTarget } from '../server/ingestion/sync/linked-db';

const CONNECTOR_ID = 'nachtresidenz-official';

async function main() {
  const cwd = process.cwd();
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const eventIds = runQuery(`
    SELECT jsonb_agg(DISTINCT event_id) AS rows
    FROM public.event_sources
    WHERE raw_payload->>'connectorId' = '${CONNECTOR_ID}';
  `);

  const ids = (eventIds as { event_id?: string }[]).map((row) => row.event_id).filter(Boolean);
  if (ids.length === 0) {
    console.log(JSON.stringify({ deletedEvents: 0 }));
    return;
  }

  const idList = ids.map((id) => `'${id}'`).join(',');
  runQuery(`DELETE FROM public.event_lineup WHERE event_id IN (${idList});`);
  runQuery(`DELETE FROM public.event_genres WHERE event_id IN (${idList});`);
  runQuery(`DELETE FROM public.event_sources WHERE event_id IN (${idList});`);
  runQuery(`DELETE FROM public.events WHERE id IN (${idList});`);

  console.log(JSON.stringify({ deletedEvents: ids.length, connectorId: CONNECTOR_ID }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
