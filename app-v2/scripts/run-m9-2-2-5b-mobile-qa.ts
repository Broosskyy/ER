#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';

const CONSUMER_BASE = process.env.CONSUMER_BASE_URL ?? 'http://localhost:8081';
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const OUT = join(process.cwd(), '..', 'artifacts', 'm9-2-2-5b-price-recovery', 'mobile-qa');

const TARGETS = [
  {
    eventId: '8a8eb9b7-593e-45de-926d-2514735b86cc',
    title: 'CHRIS STUSSY pres. by BOOTSHAUS',
    expectedPrice: '45',
    ticketUrl: 'https://bootshaus-club.ticket.io/By06xnf4/',
    cardTestId: 'home-event-8a8eb9b7-593e-45de-926d-2514735b86cc',
  },
  {
    eventId: 'b314fd67-61c5-4afe-9f12-1efabf48a602',
    title: 'Bootshaus & Loonyland pres. NYE 2026',
    expectedPrice: '29',
    ticketUrl: 'https://bootshaus-club.ticket.io/S0cbXDda/',
    cardTestId: 'home-event-b314fd67-61c5-4afe-9f12-1efabf48a602',
  },
];

async function findCard(page: import('playwright').Page, testId: string, title: string) {
  const card = page.getByTestId(testId);
  if (await card.count()) {
    return card.first();
  }
  const list = page.getByTestId('home-event-list');
  await list.waitFor({ state: 'visible', timeout: 120000 });
  for (let i = 0; i < 120; i += 1) {
    if (await card.count()) {
      return card.first();
    }
    await list.evaluate((node) => {
      (node as HTMLElement).scrollTop += 480;
    });
    await page.waitForTimeout(150);
  }
  return page.getByText(title, { exact: false }).first();
}

async function auditEvent(browser: Browser, target: (typeof TARGETS)[number]) {
  const dir = join(OUT, target.eventId);
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });

  await page.goto(`${CONSUMER_BASE}/`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('[data-testid="home-event-list"]', { timeout: 120000 });
  const card = await findCard(page, target.cardTestId, target.title);
  const cardText = await card.innerText();
  await card.screenshot({ path: join(dir, 'card.png') });

  await page.goto(`${CONSUMER_BASE}/event/${target.eventId}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('[data-testid="event-detail-content"]', { timeout: 120000 });
  const detailText = await page.locator('[data-testid="event-detail-content"]').innerText();
  await page.screenshot({ path: join(dir, 'detail.png') });

  const cta = page.getByTestId('ticket-cta');
  const ctaByText = page.getByText('Tickets kaufen', { exact: true }).first();
  const ctaLocator = (await cta.count()) ? cta : ctaByText;
  const ctaLabel = (await ctaLocator.count()) ? await ctaLocator.innerText() : null;
  const ctaHref = (await cta.count()) ? await cta.getAttribute('href') : null;
  let ctaTarget: string | null = ctaHref;
  if (await ctaLocator.count()) {
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 20000 }).catch(() => null),
      ctaLocator.click(),
    ]);
    const targetPage = popup ?? page;
    await targetPage.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => undefined);
    ctaTarget = targetPage.url();
    if (popup) {
      await popup.close();
    } else {
      await page.goBack({ waitUntil: 'networkidle' }).catch(() => undefined);
    }
  }

  await page.close();

  const result = {
    title: target.title,
    cardPriceVisible: cardText.includes(target.expectedPrice),
    detailPriceVisible: detailText.includes(target.expectedPrice),
    cardText,
    detailTextSnippet: detailText.slice(0, 500),
    ctaLabel,
    ctaTargetMatches:
      (ctaTarget?.includes('ticket.io') ?? false) &&
      (ctaTarget?.includes(target.ticketUrl.replace(/\/$/, '')) ?? false),
    ctaTarget,
    expectedTicketUrl: target.ticketUrl,
    pass:
      cardText.includes(target.expectedPrice) &&
      detailText.includes(target.expectedPrice) &&
      (ctaTarget?.includes('ticket.io') ?? false),
  };
  writeFileSync(join(dir, 'result.json'), JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const target of TARGETS) {
    results.push(await auditEvent(browser, target));
  }
  await browser.close();
  const summary = {
    generatedAt: new Date().toISOString(),
    allPass: results.every((r) => r.pass),
    results,
  };
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
