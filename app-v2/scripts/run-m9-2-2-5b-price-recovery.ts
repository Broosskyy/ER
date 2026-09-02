#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { toEventDisplayModelFromDetail } from '../src/data/mappers/event-core-display';
import { mapEventDetail } from '../src/data/mappers/event-core-mapper';
import { toEventCardViewModel } from '../src/features/events/formatting/event-card-view-model';
import { buildEventDetailVisibleSurface } from '../src/features/event-detail/event-detail-visible-surface';
import { createPlaywrightTicketBrowserOps } from '../server/official-connectors/ticket-evidence/create-playwright-ticket-browser-ops';
import { extractVisibleAdmissionPriceFromTicketIoBody } from '../server/official-connectors/ticket-evidence/extract-visible-admission-price';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';

const TARGETS = [
  {
    eventId: '8a8eb9b7-593e-45de-926d-2514735b86cc',
    title: 'CHRIS STUSSY pres. by BOOTSHAUS',
  },
  {
    eventId: 'b314fd67-61c5-4afe-9f12-1efabf48a602',
    title: 'Bootshaus & Loonyland pres. NYE 2026',
  },
];

const OUT = join(process.cwd(), '..', 'artifacts', 'm9-2-2-5b-price-recovery');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const browserOps = createPlaywrightTicketBrowserOps();

  const bootshausEvents = loadJsonAgg<{
    id: string;
    title: string;
    ticket_url: string | null;
    price_from_minor: number | null;
    currency: string | null;
    sales_status: string | null;
    ticket_action: string | null;
    updated_at: string | null;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.title) AS rows FROM (
      SELECT e.id, e.title, t.ticket_url, t.price_from_minor, t.currency, t.sales_status, t.updated_at
      FROM public.events e
      JOIN public.event_sources s ON s.event_id = e.id AND s.source_role = 'official'
      JOIN public.event_tickets t ON t.event_id = e.id
      WHERE s.source_url ILIKE '%bootshaus%'
        AND e.status = 'published'
        AND t.ticket_url ILIKE '%ticket.io%'
    ) t;`,
  );

  const crossCheck = [];
  for (const event of bootshausEvents) {
    if (!event.ticket_url) {
      continue;
    }
    const fetch = await browserOps.fetchTicketPage(event.ticket_url);
    const visible = extractVisibleAdmissionPriceFromTicketIoBody(fetch.body, fetch.finalUrl || event.ticket_url);
    crossCheck.push({
      eventId: event.id,
      title: event.title,
      liveAdmissionMinor: visible.amountMinor,
      liveProduct: visible.productLabel,
      dbPriceMinor: event.price_from_minor,
      dbStatus: event.sales_status,
      priceMatch: visible.amountMinor === event.price_from_minor,
      missingInDb: visible.amountMinor != null && event.price_from_minor == null,
    });
  }

  const traces = [];
  for (const target of TARGETS) {
    const rows = loadJsonAgg<{
      id: string;
      title: string;
      description: string | null;
      ticket_id: string;
      ticket_url: string | null;
      price_from_minor: number | null;
      currency: string | null;
      sales_status: string | null;
      ticket_action: string | null;
      updated_at: string | null;
    }>(
      runQuery,
      `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
        SELECT e.id, e.title, e.description, t.id AS ticket_id, t.ticket_url, t.price_from_minor, t.currency,
               t.sales_status, t.updated_at
        FROM public.events e
        LEFT JOIN public.event_tickets t ON t.event_id = e.id
        WHERE e.id = '${target.eventId}'
      ) t;`,
    );
    const row = rows[0];
    if (!row?.ticket_url) {
      throw new Error(`missing_ticket_url:${target.eventId}`);
    }
    const fetch = await browserOps.fetchTicketPage(row.ticket_url);
    const visible = extractVisibleAdmissionPriceFromTicketIoBody(fetch.body, fetch.finalUrl || row.ticket_url);
    const lineup = loadJsonAgg(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_lineup t WHERE t.event_id = '${target.eventId}';`);
    const genres = loadJsonAgg(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_genres t WHERE t.event_id = '${target.eventId}';`);
    const tickets = loadJsonAgg(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_tickets t WHERE t.event_id = '${target.eventId}';`);
    const venue = loadJsonAgg(runQuery, `SELECT jsonb_agg(row_to_json(v)) AS rows FROM public.venues v JOIN public.events e ON e.venue_id = v.id WHERE e.id = '${target.eventId}';`);
    const eventRow = loadJsonAgg(runQuery, `SELECT jsonb_agg(row_to_json(e)) AS rows FROM public.events e WHERE e.id = '${target.eventId}';`);
    const detail = mapEventDetail(eventRow[0], venue[0] ?? null, lineup, genres, tickets);
    const display = toEventDisplayModelFromDetail(detail);
    const surface = buildEventDetailVisibleSurface(detail, display);
    const cardVm = toEventCardViewModel(display);

    traces.push({
      title: target.title,
      browserVisibleProducts: visible.browserVisibleProducts,
      selectedCurrentAdmissionProduct: {
        productName: visible.productLabel,
        amountMinor: visible.amountMinor,
      },
      persistedTicketRow: {
        ticketRowId: row.ticket_id,
        price: row.price_from_minor,
        currency: row.currency,
        availability: row.sales_status,
        action: surface.purchaseCtaLabel ? 'PURCHASE' : surface.presaleCtaLabel ? 'PRE_REGISTER' : 'NONE',
        url: row.ticket_url,
        updatedAt: row.updated_at,
      },
      consumerTicketState: {
        cardPriceLabel: cardVm.ticketLabel,
        detailPriceLabel: surface.priceText,
        cardStatus: cardVm.ticketStatus,
        detailStatus: surface.ticketBadgeStatus ?? surface.statusLabel,
        ctaLabel: surface.purchaseCtaLabel ?? surface.presaleCtaLabel,
      },
      lossPoint:
        visible.amountMinor == null
          ? 'browser_visible_products'
          : row.price_from_minor == null
            ? 'persistedTicketRow'
            : surface.priceText == null
              ? 'consumerTicketState'
              : null,
    });
  }

  await browserOps.close();
  const summary = {
    generatedAt: new Date().toISOString(),
    targets: traces,
    bootshausTicketIoCrossCheck: crossCheck,
    allVisibleAdmissionPricesPersisted: crossCheck.every((row) => !row.missingInDb),
    sourcePricesMissingInDb: crossCheck.filter((row) => row.missingInDb).length,
    wrongCurrentPrices: crossCheck.filter((row) => row.liveAdmissionMinor != null && !row.priceMatch).length,
  };
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

void main();
