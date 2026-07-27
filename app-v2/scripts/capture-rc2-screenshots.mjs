import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8091';
const OUT_DIR = join(process.cwd(), 'docs/visual-qa/events-discovery-event-detail-final');

mkdirSync(OUT_DIR, { recursive: true });

const shots = [
  { name: 'events-mobile-discovery', path: '/search', viewport: { width: 390, height: 844 } },
  { name: 'events-desktop-discovery', path: '/search', viewport: { width: 1280, height: 900 } },
  { name: 'event-detail-mobile', path: '/event/void-techno-saturday', viewport: { width: 390, height: 844 } },
  { name: 'event-detail-desktop', path: '/event/void-techno-saturday', viewport: { width: 1280, height: 900 } },
];

const browser = await chromium.launch();

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    colorScheme: shot.dark ? 'dark' : 'light',
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (shot.query) {
    const input = page.locator('[data-testid="events-search-input"], input').first();
    await input.fill(shot.query);
    await page.waitForTimeout(1500);
  }
  if (shot.waitForText) {
    await page.getByText(shot.waitForText, { exact: false }).first().waitFor({ timeout: 15000 });
  }
  if (shot.wheelY) {
    await page.mouse.move(shot.viewport.width / 2, shot.viewport.height / 2);
    await page.mouse.wheel(0, shot.wheelY);
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`), fullPage: false });
  await context.close();
  console.log(`saved ${shot.name}.png`);
}

await browser.close();
