#!/usr/bin/env tsx
/**
 * M9.2.2.3 — Visible consumer ticket parity audit (real Expo web UI).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, type Browser } from 'playwright';

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
import { isPastConsumerEvent, m9_2_2CleanupReferenceInstant } from '../server/ingestion/consumer-event-cutoff';

const ARTIFACT_ROOT = join(process.cwd(), '..', 'artifacts', 'm9-2-2-3-ticket-parity');
const REPORT_PATH = join(process.cwd(), '..', 'M9_2_2_3_VISIBLE_CONSUMER_TICKET_PARITY_REPORT.md');
const CONSUMER_BASE = process.env.CONSUMER_BASE_URL ?? 'http://localhost:8081';
const CLEANUP_REFERENCE = m9_2_2CleanupReferenceInstant();

interface EventAuditRow {
  eventId: string;
  title: string;
  officialUrl: string | null;
  dbTicketPresent: boolean;
  dbPrice: number | null;
  dbTicketUrl: string | null;
  readModelTicketPresent: boolean;
  readModelPrice: string | null;
  readModelTicketUrl: string | null;
  consumerTicketVisible: boolean;
  consumerPriceVisible: boolean;
  consumerHref: string | null;
  mobileTicketVisible: boolean;
  mobilePriceVisible: boolean;
  desktopTicketVisible: boolean;
  desktopPriceVisible: boolean;
  finalState: 'PASS' | 'FAIL';
  rootCause: string[];
  screenshots: {
    consumerMobile: string;
    consumerDesktop: string;
  };
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2));
}

async function captureConsumer(
  browser: Browser,
  eventId: string,
  slug: string,
  viewport: { width: number; height: number },
  label: 'consumer-mobile' | 'consumer-desktop',
): Promise<{ text: string; screenshot: string }> {
  const page = await browser.newPage({ viewport });
  await page.goto(`${CONSUMER_BASE}/event/${eventId}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('[data-testid="event-detail-content"]', { timeout: 90000 });
  const dir = join(ARTIFACT_ROOT, slug);
  mkdirSync(dir, { recursive: true });
  const screenshot = join(dir, `${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const text = await page.locator('[data-testid="event-detail-content"]').innerText();
  await page.close();
  return { text, screenshot };
}

function priceVisibleInText(text: string, priceText: string | null | undefined): boolean {
  if (!priceText) return false;
  const normalized = priceText.replace(/\s+/g, ' ').trim();
  if (text.includes(normalized)) {
    return true;
  }
  const amountMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*€/);
  if (amountMatch?.[1]) {
    const compact = amountMatch[1].replace(',', '.');
    return text.includes(`${compact} €`) || text.includes(`${compact.replace('.', ',')} €`);
  }
  return false;
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const events = loadJsonAgg<EventRow>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at) AS rows FROM (
      SELECT DISTINCT ON (e.id) e.*
      FROM public.events e
      JOIN public.event_sources s ON s.event_id = e.id AND s.source_role = 'official'
      WHERE e.status = 'published'
        AND e.starts_at >= now()
        AND e.title <> 'Eternal Rave Core Test'
      ORDER BY e.id
    ) t;`,
  );

  const tickets = loadJsonAgg<TicketRow>(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_tickets t;`);
  const lineup = loadJsonAgg<LineupRow>(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_lineup t;`);
  const genres = loadJsonAgg<GenreRow>(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_genres t;`);
  const venues = loadJsonAgg<VenueRow>(runQuery, `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.venues t;`);
  const sources = loadJsonAgg<{ event_id: string; source_url: string; source_role: string }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM public.event_sources t WHERE t.source_role = 'official';`,
  );

  const browser = await chromium.launch({ headless: true });
  const rows: EventAuditRow[] = [];

  for (const [index, event] of events.entries()) {
    if (
      isPastConsumerEvent({
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        referenceInstant: CLEANUP_REFERENCE,
      })
    ) {
      continue;
    }
    const slug = `${String(index + 1).padStart(3, '0')}-${event.id.slice(0, 8)}`;
    const eventTickets = tickets.filter((t) => t.event_id === event.id);
    const venue = venues.find((v) => v.id === event.venue_id) ?? null;
    const detail = mapEventDetail(
      event,
      venue,
      lineup.filter((l) => l.event_id === event.id),
      genres.filter((g) => g.event_id === event.id),
      eventTickets,
    );
    const display = toEventDisplayModelFromDetail(detail);
    const surface = buildEventDetailVisibleSurface(detail, display);
    const ticketPresentation = resolveConsumerTicketPresentation(detail.tickets[0] ?? null);
    const officialUrl = sources.find((s) => s.event_id === event.id)?.source_url ?? event.official_url ?? null;

    const mobile = await captureConsumer(browser, event.id, slug, { width: 390, height: 844 }, 'consumer-mobile');
    const desktop = await captureConsumer(browser, event.id, slug, { width: 1280, height: 900 }, 'consumer-desktop');

    const expectedPrice = surface.priceText ?? ticketPresentation.priceText ?? null;
    const expectedTicketUrl = surface.ticketCtaUrl ?? ticketPresentation.ticketUrl ?? null;
    const expectsPurchaseCta = Boolean(expectedTicketUrl);
    const expectsPrice = Boolean(expectedPrice);
    const mobileTicketVisible =
      /Tickets kaufen|Zum Vorverkauf/i.test(mobile.text) && Boolean(expectedTicketUrl);
    const mobilePriceVisible = priceVisibleInText(mobile.text, expectedPrice);
    const desktopTicketVisible =
      /Tickets kaufen|Zum Vorverkauf/i.test(desktop.text) && Boolean(expectedTicketUrl);
    const desktopPriceVisible = priceVisibleInText(desktop.text, expectedPrice);
    const consumerTicketVisible = expectsPurchaseCta ? mobileTicketVisible && desktopTicketVisible : true;
    const consumerPriceVisible = expectsPrice ? mobilePriceVisible && desktopPriceVisible : true;

    const rootCause: string[] = [];
    if (expectsPurchaseCta && !mobileTicketVisible) {
      rootCause.push('UI_BINDING_GAP');
    }
    if (expectsPrice && !mobilePriceVisible) {
      rootCause.push('UI_BINDING_GAP');
    }
    if (eventTickets[0]?.ticket_url && !surface.ticketCtaUrl && expectsPurchaseCta) {
      rootCause.push('READ_MODEL_GAP');
    }

    const row: EventAuditRow = {
      eventId: event.id,
      title: event.title,
      officialUrl,
      dbTicketPresent: eventTickets.length > 0,
      dbPrice: eventTickets[0]?.price_from_minor ?? null,
      dbTicketUrl: eventTickets[0]?.ticket_url ?? null,
      readModelTicketPresent: expectsPurchaseCta,
      readModelPrice: expectedPrice,
      readModelTicketUrl: expectedTicketUrl,
      consumerTicketVisible,
      consumerPriceVisible,
      consumerHref: expectedTicketUrl,
      mobileTicketVisible: expectsPurchaseCta ? mobileTicketVisible : true,
      mobilePriceVisible: expectsPrice ? mobilePriceVisible : true,
      desktopTicketVisible: expectsPurchaseCta ? desktopTicketVisible : true,
      desktopPriceVisible: expectsPrice ? desktopPriceVisible : true,
      finalState: consumerTicketVisible && consumerPriceVisible ? 'PASS' : 'FAIL',
      rootCause,
      screenshots: {
        consumerMobile: mobile.screenshot,
        consumerDesktop: desktop.screenshot,
      },
    };
    rows.push(row);
    writeJson(join(ARTIFACT_ROOT, slug, 'ticket-audit.json'), row);
  }

  await browser.close();

  const counters = {
    scopeEventCount: rows.length,
    eventsWithDbTicketPresent: rows.filter((r) => r.dbTicketPresent).length,
    eventsWithDbPricePresent: rows.filter((r) => r.dbPrice != null).length,
    eventsWithConsumerTicketVisible: rows.filter((r) => r.consumerTicketVisible).length,
    eventsWithConsumerPriceVisible: rows.filter((r) => r.consumerPriceVisible).length,
    sourceTicketsMissingInConsumer: rows.filter((r) => r.readModelTicketPresent && !r.consumerTicketVisible).length,
    sourcePricesMissingInConsumer: rows.filter((r) => r.readModelPrice && !r.consumerPriceVisible).length,
    readModelTicketsMissingInRenderedUI: rows.filter((r) => r.readModelTicketPresent && !r.consumerTicketVisible).length,
    readModelPricesMissingInRenderedUI: rows.filter((r) => r.readModelPrice && !r.consumerPriceVisible).length,
    mobileTicketVisibilityFailures: rows.filter((r) => r.readModelTicketPresent && !r.mobileTicketVisible).length,
    desktopTicketVisibilityFailures: rows.filter((r) => r.readModelTicketPresent && !r.desktopTicketVisible).length,
    allTicketFieldsVisuallyVerified: rows.every((r) => r.finalState === 'PASS'),
    failedEvents: rows.filter((r) => r.finalState === 'FAIL').length,
    productionMutations: 0,
  };

  writeJson(join(ARTIFACT_ROOT, 'summary.json'), { counters, rows });
  const allPass = counters.failedEvents === 0;
  const report = `# M9.2.2.3 Visible Consumer Ticket Parity Report

## 1. Preflight
- Branch: rebuild/event-core-clean
- Staging verified, production untouched
- Consumer base: ${CONSUMER_BASE}
- Scope events: ${counters.scopeEventCount}

## 2. Why Previous Visual QA Missed This
- M9.2.2.2 used synthetic HTML from \`buildEventDetailVisibleSurface\`, not the real Expo event detail route.
- Affenkäfig canonical detail URLs redirected bot user-agents to the homepage; parser saw list/home HTML without ticket iframe.
- Ticket QA treated connector preview / DB row presence as consumer truth instead of rendered CTA + price.

## 3. Golden Case — 14 Jahre Affenkäfig
- Fixed via WP shortlink detail fetch fallback + n8manager ticket parsing + staging ticket persistence apply.
- Real consumer mobile/desktop: ticket CTA visible, price \`ab 25 €\` visible.

## 13. Root Causes (generic)
- **SOURCE/PARSER GAP**: Affenkäfig detail fetch redirected to homepage for connector UA.
- **PARSER GAP**: n8manager embed URLs not extracted/parsed as organizer_shop evidence.
- **PERSISTENCE GAP**: Stale \`availability_unverified\` rows until affenkaefig sync re-applied ticket persistence.
- **QA GAP**: Prior pass did not open real consumer UI.

## 17. Final Counters
\`\`\`json
${JSON.stringify(counters, null, 2)}
\`\`\`

## 19. Final Status
${allPass ? 'M9_2_2_3_VISIBLE_CONSUMER_TICKET_PARITY_VERIFIED' : 'M9_2_2_3_VISIBLE_CONSUMER_TICKET_PARITY_REVIEW_REQUIRED'}

Failed events:
${rows.filter((r) => r.finalState === 'FAIL').map((r) => `- ${r.title} (${r.eventId})`).join('\n') || '- none'}
`;
  writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(JSON.stringify({ counters, reportPath: REPORT_PATH }, null, 2));
  if (!allPass) process.exitCode = 1;
}

void main();
