#!/usr/bin/env tsx
/**
 * M9.2.2.5C — Staging-only consumer regression repair.
 *
 * - Archive Chris Stassy duplicate (keep Chris Stussy canonical)
 * - Archive ended Nibirii Festival 2026 (keep future NIBIRII club nights)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { classifyConsumerEventLifecycle } from '../server/ingestion/consumer-event-cutoff';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';

const OUT = join(process.cwd(), '.tmp', 'm9-2-2-5c-consumer-repair');
const APPLY = process.argv.includes('--apply');
const REFERENCE = new Date('2026-09-02T12:00:00+02:00');

const CHRIS_STUSSY_CANONICAL = '8a8eb9b7-593e-45de-926d-2514735b86cc';
const CHRIS_STASSY_DUPLICATE = '2c00fbb7-baa9-47eb-aaa5-52cda45c79a1';

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const published = loadJsonAgg<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    status: string;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at, t.title) AS rows FROM (
      SELECT e.id, e.title, e.starts_at, e.ends_at, e.status
      FROM public.events e
      WHERE e.status = 'published'
    ) t;`,
  );

  const repairs: Array<{ eventId: string; title: string; action: string; reason: string }> = [];

  for (const row of published) {
    if (row.id === CHRIS_STASSY_DUPLICATE) {
      repairs.push({
        eventId: row.id,
        title: row.title,
        action: 'archive',
        reason: 'duplicate_of_chris_stussy_canonical',
      });
    }

    const lifecycle = classifyConsumerEventLifecycle({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      referenceInstant: REFERENCE,
    });

    if (lifecycle === 'ENDED' && /nibirii festival 2026/i.test(row.title)) {
      repairs.push({
        eventId: row.id,
        title: row.title,
        action: 'archive',
        reason: 'ended_festival_before_consumer_reference_date',
      });
    }
  }

  const plan = {
    generatedAt: new Date().toISOString(),
    referenceInstant: REFERENCE.toISOString(),
    apply: APPLY,
    preserveCanonicalChrisStussy: CHRIS_STUSSY_CANONICAL,
    repairs,
  };
  writeFileSync(join(OUT, 'repair-plan.json'), JSON.stringify(plan, null, 2));

  if (!APPLY) {
    console.log(JSON.stringify({ mode: 'dry_run', repairs }, null, 2));
    return;
  }

  for (const repair of repairs) {
    runQuery(
      `UPDATE public.events SET status = 'archived', updated_at = now() WHERE id = '${repair.eventId}' AND status = 'published';`,
    );
  }

  const postPublished = loadJsonAgg<{ id: string; title: string; status: string }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT e.id, e.title, e.status FROM public.events e
      WHERE e.id IN ('${CHRIS_STUSSY_CANONICAL}', '${CHRIS_STASSY_DUPLICATE}')
         OR e.title ILIKE '%nibirii festival 2026%'
    ) t;`,
  );

  writeFileSync(join(OUT, 'post-repair.json'), JSON.stringify(postPublished, null, 2));
  console.log(JSON.stringify({ mode: 'applied', repairs, postPublished }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
