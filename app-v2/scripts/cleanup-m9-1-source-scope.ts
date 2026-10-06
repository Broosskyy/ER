#!/usr/bin/env tsx
/**
 * M9.1 — fail-closed staging cleanup for removed official sources.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import {
  compareTicketSnapshots,
  normalizeTicketRows,
} from '../server/ingestion/sync/ticket-snapshot';

const OUT_DIR = '.tmp/m9-1-source-cleanup';

const REMOVED_CONNECTORS = [
  'nachtresidenz-official',
  'stadtgarten-official',
  'zakk-official',
] as const;

const KEPT_OFFICIAL_CONNECTORS = ['bootshaus-official', 'affenkaefig-official'] as const;

const M2_TEST_EVENT_TITLE = 'Eternal Rave Core Test';

interface AffectedEventRow {
  event_id: string;
  title: string;
  official_connectors: string[] | null;
}

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

function quoteList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(',');
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const preTickets = normalizeTicketRows(
    loadJsonAgg<Record<string, unknown>>(
      runQuery,
      `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
    ),
  );
  writeJson('pre-tickets.json', { rows: preTickets });

  const affected = loadJsonAgg<AffectedEventRow>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.title) AS rows
    FROM (
      SELECT
        e.id AS event_id,
        e.title,
        array_agg(DISTINCT s.raw_payload->>'connectorId') FILTER (
          WHERE s.source_role = 'official' AND s.raw_payload->>'connectorId' IS NOT NULL
        ) AS official_connectors
      FROM public.events e
      JOIN public.event_sources s ON s.event_id = e.id
      WHERE s.raw_payload->>'connectorId' IN (${quoteList(REMOVED_CONNECTORS)})
      GROUP BY e.id, e.title
    ) t;
    `,
  );

  const toDeleteCanonical: AffectedEventRow[] = [];
  const toUnbindOnly: AffectedEventRow[] = [];
  const uncertain: AffectedEventRow[] = [];

  for (const row of affected) {
    const connectors = (row.official_connectors ?? []).filter(Boolean);
    const kept = connectors.filter((c) =>
      (KEPT_OFFICIAL_CONNECTORS as readonly string[]).includes(c),
    );
    const removed = connectors.filter((c) =>
      (REMOVED_CONNECTORS as readonly string[]).includes(c),
    );
    const unknown = connectors.filter(
      (c) =>
        !(KEPT_OFFICIAL_CONNECTORS as readonly string[]).includes(c) &&
        !(REMOVED_CONNECTORS as readonly string[]).includes(c),
    );

    if (unknown.length > 0) {
      uncertain.push(row);
      continue;
    }
    if (kept.length === 0) {
      toDeleteCanonical.push(row);
    } else if (removed.length > 0) {
      toUnbindOnly.push(row);
    }
  }

  writeJson('classification.json', {
    affectedCount: affected.length,
    toDeleteCanonical,
    toUnbindOnly,
    uncertain,
  });

  if (uncertain.length > 0) {
    throw new Error(`uncertain_events:${uncertain.length}`);
  }

  for (const row of toUnbindOnly) {
    runQuery(`
      DELETE FROM public.event_sources
      WHERE event_id = '${row.event_id}'::uuid
        AND raw_payload->>'connectorId' IN (${quoteList(REMOVED_CONNECTORS)});
    `);
  }

  if (toDeleteCanonical.length > 0) {
    const idList = toDeleteCanonical.map((row) => `'${row.event_id}'`).join(',');
    runQuery(`DELETE FROM public.event_lineup WHERE event_id IN (${idList});`);
    runQuery(`DELETE FROM public.event_genres WHERE event_id IN (${idList});`);
    runQuery(`DELETE FROM public.event_sources WHERE event_id IN (${idList});`);
    runQuery(`DELETE FROM public.event_tickets WHERE event_id IN (${idList});`);
    runQuery(`DELETE FROM public.events WHERE id IN (${idList});`);
  }

  runQuery(`
    UPDATE public.events
    SET status = 'draft'
    WHERE title = '${M2_TEST_EVENT_TITLE}'
      AND status = 'published';
  `);

  const postTickets = normalizeTicketRows(
    loadJsonAgg<Record<string, unknown>>(
      runQuery,
      `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
    ),
  );
  const ticketDelta = compareTicketSnapshots(preTickets, postTickets);

  const survivingTickets = preTickets.filter((row) =>
    postTickets.some((post) => post.id === row.id),
  );
  const survivingPost = postTickets.filter((row) =>
    preTickets.some((pre) => pre.id === row.id),
  );
  const survivingDelta = compareTicketSnapshots(survivingTickets, survivingPost);

  writeJson('post-tickets.json', { rows: postTickets, delta: ticketDelta, survivingDelta });

  if (
    survivingDelta.ticketRowsChanged !== 0 ||
    survivingDelta.ticketPricesChanged !== 0 ||
    survivingDelta.ticketUrlsChanged !== 0 ||
    survivingDelta.ticketStatusesChanged !== 0
  ) {
    throw new Error(`ticket_freeze_violation:${JSON.stringify(survivingDelta)}`);
  }

  const consumerCount = loadJsonAgg<{ count: number }>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT COUNT(*)::int AS count
      FROM public.events e
      WHERE e.status = 'published' AND e.starts_at >= now()
    ) t;
    `,
  );

  console.log(
    JSON.stringify({
      deletedCanonicalEvents: toDeleteCanonical.length,
      unboundOnlyEvents: toUnbindOnly.length,
      removedBindingsOnly: toUnbindOnly.map((r) => r.title),
      deletedTitles: toDeleteCanonical.map((r) => r.title),
      ticketDelta,
      survivingTicketDelta: survivingDelta,
      futurePublishedConsumerEvents: consumerCount[0]?.count ?? 0,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
