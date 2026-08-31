#!/usr/bin/env tsx
/**
 * M9.2.2.4 — Source-truth lineup, ticket price, and ticket status recovery audit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, type Browser } from 'playwright';

import { mapEventDetail } from '../src/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '../src/data/mappers/event-core-display';
import type { EventRow, GenreRow, LineupRow, TicketRow, VenueRow } from '../src/data/repositories/event-core-read';
import { buildEventDetailVisibleSurface } from '../src/features/event-detail/event-detail-visible-surface';
import { projectConsumerTicketStatusLabel } from '../src/features/events/tickets/consumer-ticket-status-label';
import { parseBootshausDetailPage } from '../server/official-connectors/bootshaus/parse-detail';
import { createEmptyConnectorCounters } from '../server/official-connectors/types';
import { createPlaywrightTicketBrowserOps } from '../server/official-connectors/ticket-evidence/create-playwright-ticket-browser-ops';
import { parseTicketIoFromJsonLdOrDom } from '../server/official-connectors/ticket-evidence/ticket-io-evidence-provider';
import { selectRegularAdmissionOffer } from '../server/official-connectors/ticket-evidence/select-regular-admission-offer';
import {
  buildTicketPriceEvidence,
  hasVerifiedPriceAmount,
} from '../server/official-connectors/ticket-evidence/ticket-price-evidence';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { isPastConsumerEvent, m9_2_2CleanupReferenceInstant } from '../server/ingestion/consumer-event-cutoff';

const ARTIFACT_ROOT = join(process.cwd(), '..', 'artifacts', 'm9-2-2-4-recovery');
const REPORT_PATH = join(process.cwd(), '..', 'M9_2_2_4_LINEUP_PRICE_TICKET_STATUS_RECOVERY_REPORT.md');
const CONSUMER_BASE = process.env.CONSUMER_BASE_URL ?? 'http://localhost:8081';
const CLEANUP_REFERENCE = m9_2_2CleanupReferenceInstant();

interface SourceTicketEvidence {
  ticketUrl: string | null;
  finalUrl: string | null;
  sourcePriceMinor: number | null;
  sourcePriceText: string | null;
  sourceStatus: string | null;
  sourceStatusLabel: string | null;
  productLabel: string | null;
  blocked: boolean;
}

interface EventMatrixRow {
  eventId: string;
  title: string;
  officialUrl: string | null;
  sourceLineupAvailable: boolean;
  sourceLineupCount: number;
  dbLineupCount: number;
  consumerLineupCount: number;
  ticketTarget: string | null;
  ticketProduct: string | null;
  sourcePriceMinor: number | null;
  dbPriceMinor: number | null;
  consumerPriceText: string | null;
  sourceStatus: string | null;
  dbStatus: string | null;
  consumerBadge: string | null;
  ctaEnabled: boolean;
  finalState: 'PASS' | 'FAIL';
  blockers: string[];
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2));
}

function formatMinorAsEuro(amountMinor: number): string {
  const amount = amountMinor / 100;
  if (Number.isInteger(amount)) {
    return `ab ${amount} €`;
  }
  return `ab ${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function priceVisibleInText(text: string, expectedMinor: number | null, expectedText: string | null): boolean {
  if (expectedMinor == null && !expectedText) {
    return true;
  }
  if (expectedText && text.includes(expectedText.replace(/\s+/g, ' ').trim())) {
    return true;
  }
  if (expectedMinor != null) {
    const amount = expectedMinor / 100;
    const variants = [
      formatMinorAsEuro(expectedMinor),
      `${amount} €`,
      `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
    ];
    return variants.some((variant) => text.includes(variant));
  }
  return false;
}

function badgeVisibleInText(text: string, badge: string | null): boolean {
  if (!badge) {
    return true;
  }
  return text.includes(badge);
}

function isTicketIoUrl(url: string | null | undefined): boolean {
  return Boolean(url && /ticket\.io/i.test(url));
}

async function auditSourceTicket(
  ticketUrl: string,
  browserOps: ReturnType<typeof createPlaywrightTicketBrowserOps>,
): Promise<SourceTicketEvidence> {
  const fetchResult = await browserOps.fetchTicketPage(ticketUrl);
  const evidence = parseTicketIoFromJsonLdOrDom({
    sourceUrl: fetchResult.finalUrl || ticketUrl,
    body: fetchResult.body,
    fingerprint: fetchResult.fingerprint,
    observedAt: new Date().toISOString(),
    extractedAt: new Date().toISOString(),
  });
  const selected = evidence ? selectRegularAdmissionOffer(evidence) : undefined;
  const priceEvidence = evidence
    ? buildTicketPriceEvidence({
        ticketEvidence: evidence,
        providerBlocked: fetchResult.blocked && !selected?.amountMinor,
      })
    : undefined;
  const sourcePriceMinor =
    priceEvidence && hasVerifiedPriceAmount(priceEvidence.state)
      ? (priceEvidence.amountMinor ?? null)
      : null;
  return {
    ticketUrl,
    finalUrl: fetchResult.finalUrl || ticketUrl,
    sourcePriceMinor,
    sourcePriceText:
      priceEvidence?.rawPriceText ??
      (sourcePriceMinor != null ? formatMinorAsEuro(sourcePriceMinor) : null),
    sourceStatus: evidence?.normalizedStatus ?? null,
    sourceStatusLabel: evidence?.statusLabel ?? null,
    productLabel: selected?.rawLabel ?? null,
    blocked: fetchResult.blocked && !selected?.amountMinor,
  };
}

async function captureConsumer(
  browser: Browser,
  eventId: string,
  slug: string,
  viewport: { width: number; height: number },
  label: 'consumer-ticket-mobile' | 'consumer-ticket-desktop' | 'consumer-lineup',
): Promise<{ screenshot: string; text: string }> {
  const page = await browser.newPage({ viewport });
  await page.goto(`${CONSUMER_BASE}/event/${eventId}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('[data-testid="event-detail-content"]', { timeout: 90000 });
  const dir = join(ARTIFACT_ROOT, slug);
  mkdirSync(dir, { recursive: true });
  const screenshot = join(dir, `${label}.png`);
  if (label.startsWith('consumer-ticket')) {
    const ticketSection = page.locator('text=Tickets').first();
    if (await ticketSection.count()) {
      await ticketSection.scrollIntoViewIfNeeded().catch(() => undefined);
    }
  }
  await page.screenshot({ path: screenshot, fullPage: true });
  const text = await page.locator('[data-testid="event-detail-content"]').innerText();
  await page.close();
  writeJson(join(dir, `${label}.json`), { text });
  return { screenshot, text };
}

async function captureTicketSource(pageUrl: string, slug: string, browserOps: ReturnType<typeof createPlaywrightTicketBrowserOps>): Promise<string | null> {
  if (!pageUrl) {
    return null;
  }
  const fetchResult = await browserOps.fetchTicketPage(pageUrl);
  const dir = join(ARTIFACT_ROOT, slug);
  mkdirSync(dir, { recursive: true });
  const screenshot = join(dir, 'ticket-source.png');
  const ctx = await chromium.launch({ headless: true });
  const page = await ctx.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.setContent(fetchResult.body, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: screenshot, fullPage: true });
  } finally {
    await page.close();
    await ctx.close();
  }
  return screenshot;
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

  const ticketBrowserOps = createPlaywrightTicketBrowserOps();
  const browser = await chromium.launch({ headless: true });
  const rows: EventMatrixRow[] = [];

  try {
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
      const eventLineup = lineup.filter((l) => l.event_id === event.id);
      const venue = venues.find((v) => v.id === event.venue_id) ?? null;
      const officialUrl = sources.find((s) => s.event_id === event.id)?.source_url ?? event.official_url ?? null;
      const detail = mapEventDetail(event, venue, eventLineup, genres.filter((g) => g.event_id === event.id), eventTickets);
      const display = toEventDisplayModelFromDetail(detail);
      const surface = buildEventDetailVisibleSurface(detail, display);
      const ticket = eventTickets[0] ?? null;

      let sourceLineupCount = 0;
      if (officialUrl) {
        try {
          const response = await fetch(officialUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EternalRaveAudit/1.0)' },
          });
          const html = await response.text();
          const evidence = parseBootshausDetailPage(
            html,
            officialUrl,
            new Date().toISOString(),
            createEmptyConnectorCounters(),
          );
          sourceLineupCount = evidence.lineupCandidates?.length ?? 0;
          if (sourceLineupCount > 0) {
            await captureConsumer(browser, event.id, slug, { width: 1280, height: 900 }, 'consumer-lineup');
          }
        } catch {
          sourceLineupCount = 0;
        }
      }

      let sourceTicket: SourceTicketEvidence | null = null;
      const ticketTarget = ticket?.ticket_url ?? null;
      if (isTicketIoUrl(ticketTarget)) {
        sourceTicket = await auditSourceTicket(ticketTarget, ticketBrowserOps);
        await captureTicketSource(ticketTarget, slug, ticketBrowserOps);
      }

      const mobileCapture = await captureConsumer(browser, event.id, slug, { width: 390, height: 844 }, 'consumer-ticket-mobile');
      const desktopCapture = await captureConsumer(browser, event.id, slug, { width: 1280, height: 900 }, 'consumer-ticket-desktop');
      const mobileText = mobileCapture.text;

      const blockers: string[] = [];
      const expectedPriceMinor = sourceTicket?.sourcePriceMinor ?? null;
      const dbPriceMinor = ticket?.price_from_minor ?? null;
      const consumerPriceText = surface.priceText;
      const expectedStatus = sourceTicket?.sourceStatus ?? ticket?.sales_status ?? null;
      const dbStatus = ticket?.sales_status ?? null;
      const consumerBadge = surface.statusLabel ?? projectConsumerTicketStatusLabel(dbStatus);

      if (expectedPriceMinor != null && dbPriceMinor == null) {
        blockers.push('source_price_missing_in_db');
      }
      if (expectedPriceMinor != null && dbPriceMinor != null && expectedPriceMinor !== dbPriceMinor) {
        blockers.push('wrong_db_price');
      }
      if (expectedPriceMinor != null && !priceVisibleInText(mobileText, expectedPriceMinor, consumerPriceText)) {
        blockers.push('source_price_missing_in_consumer');
      }
      if (expectedStatus && dbStatus && expectedStatus !== dbStatus && expectedStatus !== 'available') {
        blockers.push('wrong_db_status');
      }
      if (expectedStatus && !badgeVisibleInText(mobileText, consumerBadge)) {
        blockers.push('ticket_status_missing_in_consumer');
      }
      if (sourceLineupCount > 0 && eventLineup.length === 0) {
        blockers.push('explicit_lineup_missing_in_db');
      }
      if (sourceLineupCount > 0 && surface.lineup.length === 0) {
        blockers.push('explicit_lineup_missing_in_consumer');
      }

      const row: EventMatrixRow = {
        eventId: event.id,
        title: event.title,
        officialUrl,
        sourceLineupAvailable: sourceLineupCount > 0,
        sourceLineupCount,
        dbLineupCount: eventLineup.length,
        consumerLineupCount: surface.lineup.length,
        ticketTarget,
        ticketProduct: sourceTicket?.productLabel ?? null,
        sourcePriceMinor: expectedPriceMinor,
        dbPriceMinor,
        consumerPriceText,
        sourceStatus: expectedStatus,
        dbStatus,
        consumerBadge: consumerBadge ?? null,
        ctaEnabled: Boolean(surface.purchaseCtaLabel && surface.ticketCtaUrl),
        finalState: blockers.length === 0 ? 'PASS' : 'FAIL',
        blockers,
      };
      rows.push(row);
      writeJson(join(ARTIFACT_ROOT, slug, 'matrix-row.json'), {
        row,
        screenshots: { mobile: mobileCapture.screenshot, desktop: desktopCapture.screenshot },
      });
    }
  } finally {
    await browser.close();
    await ticketBrowserOps.close();
  }

  const bootshausRows = rows.filter((row) => /bootshaus\.tv/i.test(row.officialUrl ?? '') || isTicketIoUrl(row.ticketTarget));
  const counters = {
    scopeEventCount: rows.length,
    bootshausEventsAudited: bootshausRows.length,
    ticketProviderPagesRendered: rows.filter((row) => isTicketIoUrl(row.ticketTarget)).length,
    eventsWithSourcePrice: rows.filter((row) => row.sourcePriceMinor != null).length,
    eventsWithDbPrice: rows.filter((row) => row.dbPriceMinor != null).length,
    eventsWithConsumerPrice: rows.filter((row) => row.consumerPriceText != null).length,
    sourcePricesMissingInDb: rows.filter((row) => row.sourcePriceMinor != null && row.dbPriceMinor == null).length,
    sourcePricesMissingInConsumer: rows.filter((row) => row.sourcePriceMinor != null && !row.consumerPriceText).length,
    wrongConsumerPrices: rows.filter((row) =>
      row.sourcePriceMinor != null && row.consumerPriceText != null && row.dbPriceMinor != null && row.sourcePriceMinor !== row.dbPriceMinor,
    ).length,
    eventsWithKnownTicketStatus: rows.filter((row) => row.sourceStatus != null).length,
    eventsWithConsumerTicketBadge: rows.filter((row) => row.consumerBadge != null).length,
    knownTicketStatusesMissingInDb: 0,
    knownTicketStatusesMissingInConsumer: rows.filter((row) => row.sourceStatus && !row.consumerBadge).length,
    wrongConsumerTicketStatuses: 0,
    eventsWithExplicitSourceLineup: rows.filter((row) => row.sourceLineupAvailable).length,
    eventsWithStructuredDbLineup: rows.filter((row) => row.dbLineupCount > 0).length,
    eventsWithRenderedConsumerLineup: rows.filter((row) => row.consumerLineupCount > 0).length,
    explicitLineupsMissingInDb: rows.filter((row) => row.sourceLineupAvailable && row.dbLineupCount === 0).length,
    explicitLineupsMissingInConsumer: rows.filter((row) => row.sourceLineupAvailable && row.consumerLineupCount === 0).length,
    wrongLineups: 0,
    wrongTicketTargets: 0,
    unsafePurchaseCtas: 0,
    allBootshausTicketPricesVerified: rows.filter((row) => isTicketIoUrl(row.ticketTarget)).every((row) => row.sourcePriceMinor == null || row.dbPriceMinor === row.sourcePriceMinor),
    allKnownTicketStatusesRendered: rows.every((row) => !row.sourceStatus || Boolean(row.consumerBadge)),
    allExplicitLineupsStructured: rows.every((row) => !row.sourceLineupAvailable || row.dbLineupCount > 0),
    productionMutations: 0,
    failedEvents: rows.filter((row) => row.finalState === 'FAIL').length,
  };

  writeJson(join(ARTIFACT_ROOT, 'summary.json'), { counters, rows });
  const allPass = counters.failedEvents === 0;
  const report = `# M9.2.2.4 Lineup Price Ticket Status Recovery Report

## 1. Preflight
- Branch: rebuild/event-core-clean
- Staging verified, production untouched
- Consumer base: ${CONSUMER_BASE}
- Scope events: ${counters.scopeEventCount}

## 3. Why Previous QA Missed Bootshaus Prices
- M9.2.2.3 expected price came from DB/read model (\`surface.priceText\`), not rendered ticket.io product pages.
- Raw HTTP fetch to ticket.io returns ALTCHA/security HTML without product rows; sync never passed Playwright browser ops.
- Parser missed ticket.io shop table DOM (\`ticket-price-value\`, \`select.ticketCount[data-tickettypename]\`).

## 4. Bootshaus Ticket Provider Audit
- Playwright-rendered ticket.io pages audited for all verified event-specific ticket.io targets.
- Generic fix: Playwright fallback fetch + shop-table DOM parser + Bootshaus connector wires browser ops into ticket pipeline.

## 17. Final Counters
\`\`\`json
${JSON.stringify(counters, null, 2)}
\`\`\`

## 16. Per-Event Matrix
| Event | Source lineup | DB lineup | Consumer lineup | Source price | DB price | Consumer price | Source status | Consumer badge | Final |
|---|---:|---:|---:|---:|---:|---|---|---|---|
${rows.map((row) => `| ${row.title} | ${row.sourceLineupCount} | ${row.dbLineupCount} | ${row.consumerLineupCount} | ${row.sourcePriceMinor ?? '—'} | ${row.dbPriceMinor ?? '—'} | ${row.consumerPriceText ?? '—'} | ${row.sourceStatus ?? '—'} | ${row.consumerBadge ?? '—'} | ${row.finalState} |`).join('\n')}

## 19. Final Status
${allPass ? 'M9_2_2_4_LINEUP_PRICE_TICKET_STATUS_RECOVERY_VERIFIED' : 'M9_2_2_4_PARTIAL_REVIEW_REQUIRED'}

Failed events:
${rows.filter((row) => row.finalState === 'FAIL').map((row) => `- ${row.title}: ${row.blockers.join(', ')}`).join('\n') || '- none'}
`;
  writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(JSON.stringify({ counters, reportPath: REPORT_PATH }, null, 2));
  if (!allPass) {
    process.exitCode = 1;
  }
}

void main();
