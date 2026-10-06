#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AFFENKAEFIG_CONNECTOR_ID } from '../server/official-connectors/affenkaefig/constants';
import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';

const OUT_DIR = '.tmp/m8-7-operational';

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const health = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `SELECT jsonb_agg(to_jsonb(h) ORDER BY h.connector_id) AS rows FROM public.ingestion_source_health h;`,
  );
  const runs = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.started_at DESC) AS rows
    FROM (
      SELECT * FROM public.ingestion_runs
      ORDER BY started_at DESC
      LIMIT 30
    ) r;
    `,
  );
  const sourceCounts = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT
        (s.raw_payload->>'connectorId') AS connector_id,
        COUNT(*)::int AS source_bindings
      FROM public.event_sources s
      WHERE s.raw_payload->>'connectorId' IN ('${BOOTSHAUS_CONNECTOR_ID}', '${AFFENKAEFIG_CONNECTOR_ID}')
      GROUP BY 1
    ) t;
    `,
  );
  const ticketFingerprint = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
  );

  const payload = {
    staging: STAGING_PROJECT_REF,
    health,
    recentRuns: runs,
    sourceBindings: sourceCounts,
    ticketRowCount: ticketFingerprint.length,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'staging-state.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

void main();
