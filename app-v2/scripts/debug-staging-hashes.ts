import { writeFileSync } from 'node:fs';

import { createSupabaseCliLinkedQueryExecutor, loadJsonAgg } from '../server/ingestion/sync/linked-db';

const q = createSupabaseCliLinkedQueryExecutor();
const rows = loadJsonAgg<Record<string, unknown>>(
  q,
  `SELECT jsonb_agg(
      jsonb_build_object(
        'url', source_url,
        'hash', content_hash,
        'payload_fp', raw_payload->>'fingerprint'
      )
      ORDER BY source_url
    ) AS rows
    FROM public.event_sources
    WHERE source_role = 'official';`,
);
writeFileSync('.tmp/m8-5-staging-e2e/hash-debug.json', JSON.stringify(rows.slice(0, 10), null, 2));
