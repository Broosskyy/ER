#!/usr/bin/env tsx
/**
 * M9.2.2.5A — Direct staging ticket readback + consumer projection check.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { mapEventDetail } from '../src/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '../src/data/mappers/event-core-display';
import type { EventRow, GenreRow, LineupRow, TicketRow, VenueRow } from '../src/data/repositories/event-core-read';
import { buildEventDetailVisibleSurface } from '../src/features/event-detail/event-detail-visible-surface';
import { toEventCardViewModel } from '../src/features/events/formatting/event-card-view-model';
import { resolveConsumerTicketPresentation } from '../src/features/events/tickets/consumer-ticket-safety-gate';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';

const ARTIFACT_ROOT = join(process.cwd(), '..', 'artifacts', 'm9-2-2-5a-ticket-divergence');

const GOLDEN_EVENT_IDS = {
  zaagstep: 'f560d0f3-1bac-4bae-bf4a-48f8dfdb5f8e',
  underland: '84af63ab-bf10-4326-a9fb-f2251537dfed',
  affenkaefig14: '451f27ac-f29e-4529-a367-f901420ffc0e',
};

function writeJson(name: string, payload: unknown): void {
  mkdirSync(ARTIFACT_ROOT, { recursive: true });
  writeFileSync(join(ARTIFACT_ROOT, name), JSON.stringify(payload, null, 2));
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const recentInserts = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC) AS rows FROM (
      SELECT et.*, e.title AS event_title
      FROM public.event_tickets et
      JOIN public.events e ON e.id = et.event_id
      WHERE et.created_at >= now() - interval '7 days'
      ORDER BY et.created_at DESC
      LIMIT 10
    ) t;`,
  );

  const goldenIds = Object.values(GOLDEN_EVENT_IDS)
    .map((id) => `'${id}'`)
    .join(',');

  const events = loadJsonAgg<EventRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(e) ORDER BY e.title) AS rows
     FROM public.events e WHERE e.id IN (${goldenIds});`,
  );

  const tickets = loadJsonAgg<TicketRow & { created_at?: string; updated_at?: string }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.event_id, t.sort_order) AS rows FROM (
      SELECT et.*, et.created_at, et.updated_at
      FROM public.event_tickets et
      WHERE et.event_id IN (${goldenIds})
    ) t;`,
  );

  const sources = loadJsonAgg<{
    event_id: string;
    source_role: string;
    source_url: string;
    raw_payload: Record<string, unknown> | null;
    content_hash: string | null;
    observed_at: string | null;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(s)) AS rows FROM public.event_sources s
     WHERE s.event_id IN (${goldenIds});`,
  );

  const lineup = loadJsonAgg<LineupRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(l) ORDER BY l.sort_order) AS rows
     FROM public.event_lineup l WHERE l.event_id IN (${goldenIds});`,
  );

  const genres = loadJsonAgg<GenreRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(g)) AS rows
     FROM public.event_genres g WHERE g.event_id IN (${goldenIds});`,
  );

  const venues = loadJsonAgg<VenueRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(v)) AS rows FROM public.venues v
     JOIN public.events e ON e.venue_id = v.id WHERE e.id IN (${goldenIds});`,
  );

  const zaagstepLive = await fetch(
    'https://bootshaus.tv/events/blacklist-inurfase-pres-zaagstep-by-dr-donk/',
    { headers: { 'User-Agent': 'EternalRaveAudit/1.0' } },
  ).then((r) => r.text());

  const liveHasSibforms = /sibforms\.com/i.test(zaagstepLive);
  const liveHasBitly = /bit\.ly\/ZAAGSTEP/i.test(zaagstepLive);

  const goldenReadback = events.map((event) => {
    const eventTickets = tickets.filter((t) => t.event_id === event.id);
    const venue = venues.find((v) => v.id === event.venue_id) ?? null;
    const eventLineup = lineup.filter((l) => l.event_id === event.id);
    const eventGenres = genres.filter((g) => g.event_id === event.id);
    const eventSources = sources.filter((s) => s.event_id === event.id);
    const detail = mapEventDetail(event, venue, eventLineup, eventGenres, eventTickets);
    const display = toEventDisplayModelFromDetail(detail);
    const surface = buildEventDetailVisibleSurface(detail, display);
    const cardVm = toEventCardViewModel(display);
    const ticketPresentation = resolveConsumerTicketPresentation(detail.tickets[0] ?? null);

    return {
      eventId: event.id,
      title: event.title,
      ticketRowCount: eventTickets.length,
      ticketRows: eventTickets,
      officialSources: eventSources.filter((s) => s.source_role === 'official'),
      ticketSources: eventSources.filter((s) => s.source_role === 'ticket'),
      consumer: {
        cardBadge: cardVm.ticketStatus,
        cardTicketLabel: cardVm.ticketLabel,
        detailBadge: surface.ticketBadgeStatus ?? surface.statusLabel,
        purchaseCtaLabel: surface.purchaseCtaLabel,
        presaleCtaLabel: surface.presaleCtaLabel,
        ticketCtaUrl: surface.ticketCtaUrl,
        priceText: surface.priceText,
        ticketAction: ticketPresentation.ticketAction,
        showPurchaseCta: ticketPresentation.showPurchaseCta,
        showPresaleCta: ticketPresentation.showPresaleCta,
      },
    };
  });

  const zaagstep = goldenReadback.find((r) => r.eventId === GOLDEN_EVENT_IDS.zaagstep);

  const payload = {
    readbackAt: new Date().toISOString(),
    recentInserts,
    liveZaagstep: { hasSibformsLink: liveHasSibforms, hasBitlyCta: liveHasBitly },
    goldenReadback,
    zaagstepPersistenceVerified: Boolean(
      zaagstep &&
        zaagstep.ticketRowCount === 1 &&
        zaagstep.ticketRows[0]?.sales_status === 'sold_out' &&
        /sibforms\.com/i.test(zaagstep.ticketRows[0]?.ticket_url ?? '') &&
        zaagstep.consumer.showPresaleCta &&
        zaagstep.consumer.presaleCtaLabel === 'Vorregistrieren' &&
        !zaagstep.consumer.showPurchaseCta &&
        zaagstep.consumer.cardBadge === 'sold_out' &&
        zaagstep.consumer.detailBadge === 'sold_out',
    ),
    zaagstepDuplicateTicketRows: (zaagstep?.ticketRowCount ?? 0) > 1 ? zaagstep!.ticketRowCount - 1 : 0,
  };

  writeJson('ticket-readback.json', payload);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
