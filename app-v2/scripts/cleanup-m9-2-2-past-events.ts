#!/usr/bin/env tsx
/**
 * M9.2.2 — Past event cleanup for staging consumer inventory.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isPastConsumerEvent,
  m9_2_2CleanupReferenceInstant,
} from '../server/ingestion/consumer-event-cutoff';
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

const OUT_DIR = '.tmp/m9-2-2-past-event-cleanup';
const APPLY = process.argv.includes('--apply');
const cleanupReference = m9_2_2CleanupReferenceInstant();

interface EventInventoryRow {
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  lineup_count: number;
  genre_count: number;
  ticket_count: number;
  source_count: number;
}

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

function classifyPastEvent(row: EventInventoryRow): boolean {
  return isPastConsumerEvent({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    referenceInstant: cleanupReference,
  });
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

  const inventory = loadJsonAgg<EventInventoryRow>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at, t.title) AS rows
    FROM (
      SELECT
        e.id AS event_id,
        e.title,
        e.starts_at,
        e.ends_at,
        e.status,
        (SELECT COUNT(*)::int FROM public.event_lineup l WHERE l.event_id = e.id) AS lineup_count,
        (SELECT COUNT(*)::int FROM public.event_genres g WHERE g.event_id = e.id) AS genre_count,
        (SELECT COUNT(*)::int FROM public.event_tickets tk WHERE tk.event_id = e.id) AS ticket_count,
        (SELECT COUNT(*)::int FROM public.event_sources s WHERE s.event_id = e.id) AS source_count
      FROM public.events e
      WHERE e.status = 'published'
    ) t;
    `,
  );

  writeJson('pre-inventory.json', { inventory, preTickets });

  const pastEvents = inventory.filter(classifyPastEvent);
  const activeEvents = inventory.filter((row) => !classifyPastEvent(row));

  const dryRun = pastEvents.map((row) => ({
    eventId: row.event_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    dependencies: {
      lineup: row.lineup_count,
      genres: row.genre_count,
      tickets: row.ticket_count,
      sources: row.source_count,
    },
    proposedAction: 'delete_canonical_event',
  }));

  writeJson('dry-run.json', {
    eventsBeforeCleanup: inventory.length,
    pastEventsDetected: pastEvents.length,
    activeEventsAfterCleanup: activeEvents.length,
    pastEvents: dryRun,
  });

  const futurePastLeak = activeEvents.filter((row) => classifyPastEvent(row));
  if (futurePastLeak.length > 0) {
    throw new Error(`active_events_include_past:${futurePastLeak.length}`);
  }

  if (!APPLY) {
    console.log(
      JSON.stringify({
        mode: 'dry_run',
        eventsBeforeCleanup: inventory.length,
        pastEventsDetected: pastEvents.length,
        activeEventsAfterCleanup: activeEvents.length,
        samplePastTitles: pastEvents.slice(0, 10).map((row) => row.title),
      }),
    );
    return;
  }

  if (pastEvents.length > 0) {
    const idList = pastEvents.map((row) => `'${row.event_id}'`).join(',');
    runQuery(`DELETE FROM public.event_lineup WHERE event_id IN (${idList});`);
    runQuery(`DELETE FROM public.event_genres WHERE event_id IN (${idList});`);
    runQuery(`DELETE FROM public.event_sources WHERE event_id IN (${idList});`);
    runQuery(`DELETE FROM public.event_tickets WHERE event_id IN (${idList});`);
    runQuery(`DELETE FROM public.events WHERE id IN (${idList});`);
  }

  const postInventory = loadJsonAgg<EventInventoryRow>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at, t.title) AS rows
    FROM (
      SELECT
        e.id AS event_id,
        e.title,
        e.starts_at,
        e.ends_at,
        e.status,
        (SELECT COUNT(*)::int FROM public.event_lineup l WHERE l.event_id = e.id) AS lineup_count,
        (SELECT COUNT(*)::int FROM public.event_genres g WHERE g.event_id = e.id) AS genre_count,
        (SELECT COUNT(*)::int FROM public.event_tickets tk WHERE tk.event_id = e.id) AS ticket_count,
        (SELECT COUNT(*)::int FROM public.event_sources s WHERE s.event_id = e.id) AS source_count
      FROM public.events e
      WHERE e.status = 'published'
    ) t;
    `,
  );

  const postTickets = normalizeTicketRows(
    loadJsonAgg<Record<string, unknown>>(
      runQuery,
      `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`,
    ),
  );

  const remainingPast = postInventory.filter(classifyPastEvent);
  if (remainingPast.length > 0) {
    throw new Error(`past_events_remaining:${remainingPast.length}`);
  }

  const survivingTickets = preTickets.filter((row) => postTickets.some((post) => post.id === row.id));
  const survivingPost = postTickets.filter((row) => preTickets.some((pre) => pre.id === row.id));
  const survivingDelta = compareTicketSnapshots(survivingTickets, survivingPost);
  if (
    survivingDelta.ticketRowsChanged !== 0 ||
    survivingDelta.ticketPricesChanged !== 0 ||
    survivingDelta.ticketUrlsChanged !== 0 ||
    survivingDelta.ticketStatusesChanged !== 0
  ) {
    throw new Error(`ticket_freeze_violation:${JSON.stringify(survivingDelta)}`);
  }

  writeJson('post-inventory.json', { inventory: postInventory, postTickets, survivingDelta });

  console.log(
    JSON.stringify({
      mode: 'apply',
      eventsBeforeCleanup: inventory.length,
      pastEventsRemovedOrArchived: pastEvents.length,
      activeEventsAfterCleanup: postInventory.length,
      pastEventsRemainingThrough2026_08_28: remainingPast.length,
      survivingTicketDelta: survivingDelta,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
