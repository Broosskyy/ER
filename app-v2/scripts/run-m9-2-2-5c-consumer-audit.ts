#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

import {
  buildConsumerDuplicateGroups,
  getDiscoverablePublishedEvents,
} from '../src/features/events/discovery/consumer-discovery-feed';
import { classifyConsumerEventLifecycle } from '../server/ingestion/consumer-event-cutoff';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';

const CONSUMER_BASE = process.env.CONSUMER_BASE_URL ?? 'http://localhost:8081';
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const OUT = join(process.cwd(), '..', 'artifacts', 'm9-2-2-5c-consumer-recovery');

interface RenderedCard {
  testId: string | null;
  title: string;
  text: string;
  eventId: string | null;
}

async function collectRenderedCards(screenshotName: string): Promise<RenderedCard[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
  await page.goto(`${CONSUMER_BASE}/`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('[data-testid="home-event-list"]', { timeout: 120000 });

  const list = page.getByTestId('home-event-list');
  const seen = new Set<string>();
  const cards: RenderedCard[] = [];

  let stagnantPasses = 0;
  for (let i = 0; i < 200 && stagnantPasses < 8; i += 1) {
    const before = seen.size;
    const nodes = page.locator('[data-testid^="home-event-"]:not([data-testid="home-event-list"])');
    const count = await nodes.count();
    for (let j = 0; j < count; j += 1) {
      const node = nodes.nth(j);
      const testId = await node.getAttribute('data-testid', { timeout: 5000 }).catch(() => null);
      if (!testId || seen.has(testId)) {
        continue;
      }
      seen.add(testId);
      const text = await node.innerText({ timeout: 5000 }).catch(() => '');
      const titleLine = text.split('\n').find((line) => line.trim().length > 3) ?? text;
      const eventId = testId.replace('home-event-', '') || null;
      cards.push({ testId, title: titleLine.trim(), text, eventId });
    }
    if (seen.size === before) {
      stagnantPasses += 1;
    } else {
      stagnantPasses = 0;
    }
    await list.evaluate((node) => {
      (node as HTMLElement).scrollTop += 500;
    });
    await page.waitForTimeout(120);
  }

  await page.screenshot({ path: join(OUT, screenshotName), fullPage: true });
  await browser.close();
  return cards;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const referenceInstant = new Date('2026-09-02T12:00:00+02:00');

  const publishedRows = loadJsonAgg<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    timezone: string | null;
    image_url: string | null;
    official_url: string | null;
    organizer_name: string | null;
    venue_id: string | null;
    venue_name: string | null;
    venue_city: string | null;
    ticket_url: string | null;
    price_from_minor: number | null;
    currency: string | null;
    sales_status: string | null;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at, t.title) AS rows FROM (
      SELECT e.id, e.title, e.starts_at, e.ends_at, e.timezone, e.image_url, e.official_url, e.organizer_name,
        v.id AS venue_id, v.name AS venue_name, v.city AS venue_city,
        t.ticket_url, t.price_from_minor, t.currency, t.sales_status
      FROM events e
      LEFT JOIN venues v ON v.id = e.venue_id
      LEFT JOIN event_tickets t ON t.event_id = e.id AND t.sort_order = 0
      WHERE e.status = 'published'
    ) t;`,
  );

  const publishedSummaries = publishedRows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    imageUrl: row.image_url,
    officialUrl: row.official_url,
    organizerName: row.organizer_name,
    venue: row.venue_id
      ? {
          id: row.venue_id,
          name: row.venue_name ?? '',
          addressLine: null,
          postalCode: null,
          city: row.venue_city,
          countryCode: null,
          latitude: null,
          longitude: null,
          officialUrl: null,
        }
      : null,
    genres: [],
    primaryTicket: row.ticket_url
      ? {
          id: `${row.id}-ticket`,
          provider: 'ticket_io',
          ticketUrl: row.ticket_url,
          priceFromMinor: row.price_from_minor,
          currency: row.currency,
          salesStatus: row.sales_status,
          sortOrder: 0,
        }
      : null,
  }));

  const feed = getDiscoverablePublishedEvents(publishedSummaries, { referenceInstant });
  const setA = feed.events;
  const setB = feed.events;
  const renderedCards = await collectRenderedCards('home-after.png');
  const renderedIds = new Set(renderedCards.map((card) => card.eventId).filter(Boolean));
  const eligibleIds = new Set(setA.map((event) => event.id));

  const renderedPast = renderedCards.filter((card) => {
    const row = publishedRows.find((entry) => entry.id === card.eventId);
    if (!row) {
      return false;
    }
    return (
      classifyConsumerEventLifecycle({
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: 'published',
        referenceInstant,
      }) === 'ENDED'
    );
  });

  const duplicateGroups = buildConsumerDuplicateGroups(
    publishedSummaries.filter((event) => renderedIds.has(event.id)),
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    referenceInstant: referenceInstant.toISOString(),
    inventoryParity: {
      setA_eligibleCanonical: setA.length,
      setB_consumerReadModel: setB.length,
      setC_renderedCards: renderedCards.length,
      missingFromConsumer: setA.filter((event) => !renderedIds.has(event.id)).map((event) => event.title),
      unexpectedInConsumer: renderedCards
        .filter((card) => card.eventId && !eligibleIds.has(card.eventId))
        .map((card) => ({ title: card.title, eventId: card.eventId })),
      duplicateRenderedCards: duplicateGroups,
    },
    chrisStussyVisibleCardCount: renderedCards.filter((card) => /chris\s+stus/i.test(card.text)).length,
    chrisStassyVisibleCardCount: renderedCards.filter((card) => /chris\s+stas/i.test(card.text)).length,
    nibiriiFestival2026VisibleCardCount: renderedCards.filter((card) => /nibirii festival 2026/i.test(card.text))
      .length,
    nibiriiClubNightVisibleCardCount: renderedCards.filter((card) => /nibirii pres\./i.test(card.text)).length,
    consumerVisibleDuplicateGroups: duplicateGroups.length,
    highConfidenceConsumerDuplicates: duplicateGroups.filter((group) => group.confidence === 'high').length,
    ambiguousConsumerDuplicates: duplicateGroups.filter((group) => group.confidence === 'ambiguous').length,
    renderedPastEventCards: renderedPast.length,
    renderedPastEventTitles: renderedPast.map((card) => card.title),
    renderedCards,
  };

  writeFileSync(join(OUT, 'rendered-audit.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
