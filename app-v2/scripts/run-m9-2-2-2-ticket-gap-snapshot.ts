#!/usr/bin/env tsx
/**
 * M9.2.2.2 — Pre/post snapshot for four known ticket persistence gaps.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { mapEventDetail } from '../src/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '../src/data/mappers/event-core-display';
import type { EventRow, GenreRow, LineupRow, TicketRow, VenueRow } from '../src/data/repositories/event-core-read';
import { buildEventDetailVisibleSurface } from '../src/features/event-detail/event-detail-visible-surface';
import { resolveConsumerTicketPresentation } from '../src/features/events/tickets/consumer-ticket-safety-gate';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';

const FOUR_EVENT_IDS = [
  '301c217d-651a-4110-b759-a019f6546bb1',
  '2c00fbb7-baa9-47eb-aaa5-52cda45c79a1',
  'ee4a1d07-d310-4a0a-bebf-d44f5bcf3a9a',
  '7a1d2000-19cf-4aa6-ba1d-12240f70c32a',
];

const OUT_DIR = join(process.cwd(), '..', 'artifacts', 'm9-2-2-2-ticket-gap-closure');

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

async function main() {
  const label = process.argv[2]?.trim() || 'snapshot';
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const idList = FOUR_EVENT_IDS.map((id) => `'${id}'`).join(',');

  const events = loadJsonAgg<EventRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.title) AS rows FROM (
      SELECT * FROM public.events e WHERE e.id IN (${idList})
    ) t;`,
  );

  const sources = loadJsonAgg<{
    event_id: string;
    source_role: string;
    source_url: string;
    raw_payload: Record<string, unknown> | null;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT event_id, source_role, source_url, raw_payload
      FROM public.event_sources WHERE event_id IN (${idList})
    ) t;`,
  );

  const tickets = loadJsonAgg<TicketRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.event_id, t.sort_order) AS rows FROM (
      SELECT * FROM public.event_tickets WHERE event_id IN (${idList})
    ) t;`,
  );

  const lineup = loadJsonAgg<LineupRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT * FROM public.event_lineup WHERE event_id IN (${idList}) ORDER BY sort_order
    ) t;`,
  );

  const genres = loadJsonAgg<GenreRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT * FROM public.event_genres WHERE event_id IN (${idList})
    ) t;`,
  );

  const venues = loadJsonAgg<VenueRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT v.* FROM public.venues v
      JOIN public.events e ON e.venue_id = v.id
      WHERE e.id IN (${idList})
    ) t;`,
  );

  const venueByEvent = new Map<string, VenueRow>();
  for (const event of events) {
    const venue = venues.find((v) => v.id === event.venue_id) ?? null;
    if (venue) venueByEvent.set(event.id, venue);
  }

  const rows = events.map((event) => {
    const eventTickets = tickets.filter((t) => t.event_id === event.id);
    const eventSources = sources.filter((s) => s.event_id === event.id);
    const venue = venueByEvent.get(event.id) ?? null;
    const eventLineup = lineup.filter((l) => l.event_id === event.id);
    const eventGenres = genres.filter((g) => g.event_id === event.id);
    const detail = mapEventDetail(event, venue, eventLineup, eventGenres, eventTickets);
    const display = toEventDisplayModelFromDetail(detail);
    const surface = buildEventDetailVisibleSurface(detail, display);
    const ticketPresentation = resolveConsumerTicketPresentation(detail.tickets[0] ?? null);

    return {
      canonicalEventId: event.id,
      title: event.title,
      startsAt: event.starts_at,
      officialBindings: eventSources.filter((s) => s.source_role === 'official'),
      supplementalBindings: eventSources.filter((s) => s.source_role !== 'official'),
      eventTickets: eventTickets,
      consumer: {
        ticketCtaUrl: surface.ticketCtaUrl,
        priceText: surface.priceText,
        statusLabel: surface.statusLabel,
        showPurchaseCta: ticketPresentation.showPurchaseCta,
        ticketUrl: ticketPresentation.ticketUrl,
      },
    };
  });

  writeJson(`${label}.json`, { capturedAt: new Date().toISOString(), events: rows });
  console.log(JSON.stringify({ label, outDir: OUT_DIR, eventCount: rows.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
