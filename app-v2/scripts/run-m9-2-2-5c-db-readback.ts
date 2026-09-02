#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { classifyConsumerEventLifecycle } from '../server/ingestion/consumer-event-cutoff';
import { isDiscoverableConsumerLifecycle } from '../shared/consumer-event-lifecycle';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';

const OUT = join(process.cwd(), '..', 'artifacts', 'm9-2-2-5c-consumer-recovery');
const REFERENCE = new Date('2026-09-02T12:00:00+02:00');

const CHRIS_STUSSY = '8a8eb9b7-593e-45de-926d-2514735b86cc';
const CHRIS_STASSY = '2c00fbb7-baa9-47eb-aaa5-52cda45c79a1';
const NIBIRII_FESTIVAL = '7af0f06a-81e1-4708-8359-4a1078b600e3';
const NIBIRII_ELY = '301c217d-651a-4110-b759-a019f6546bb1';

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const rows = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT e.id, e.title, e.status, e.starts_at, e.ends_at, e.description IS NOT NULL AS has_description,
        (SELECT COUNT(*)::int FROM event_lineup l WHERE l.event_id = e.id) AS lineup_count,
        (SELECT COUNT(*)::int FROM event_genres g WHERE g.event_id = e.id) AS genre_count,
        (SELECT COUNT(*)::int FROM event_sources s WHERE s.event_id = e.id) AS source_count,
        t.price_from_minor, t.currency, t.sales_status, t.ticket_url,
        (SELECT array_agg(s.source_url ORDER BY s.source_url) FROM event_sources s WHERE s.event_id = e.id) AS source_urls
      FROM events e
      LEFT JOIN event_tickets t ON t.event_id = e.id AND t.sort_order = 0
      WHERE e.id IN (
        '${CHRIS_STUSSY}', '${CHRIS_STASSY}', '${NIBIRII_FESTIVAL}', '${NIBIRII_ELY}'
      )
    ) t;`,
  );

  const enriched = rows.map((row) => {
    const lifecycle = classifyConsumerEventLifecycle({
      startsAt: String(row.starts_at),
      endsAt: row.ends_at as string | null,
      status: String(row.status),
      referenceInstant: REFERENCE,
    });
    return {
      ...row,
      lifecycle,
      consumerEligible: row.status === 'published' && isDiscoverableConsumerLifecycle(lifecycle),
    };
  });

  writeFileSync(join(OUT, 'db-readback.json'), JSON.stringify({ referenceInstant: REFERENCE.toISOString(), rows: enriched }, null, 2));
  console.log(JSON.stringify(enriched, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
