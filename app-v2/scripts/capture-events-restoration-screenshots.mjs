import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8091';
const OUT_DIR = join(process.cwd(), 'docs/visual-qa/events-event-detail-restoration');

mkdirSync(OUT_DIR, { recursive: true });

const shots = [
  { name: 'events-mobile-light', path: '/search', viewport: { width: 390, height: 844 } },
  { name: 'events-mobile-dark', path: '/search', viewport: { width: 390, height: 844 }, dark: true },
  { name: 'events-map-toggle-mobile', path: '/search?view=map', viewport: { width: 390, height: 844 } },
  { name: 'event-detail-mobile', path: '/event/void-techno-saturday', viewport: { width: 390, height: 844 } },
  { name: 'event-detail-postponed-mobile', path: '/event/klangkuenstler-berghain', viewport: { width: 390, height: 844 } },
  { name: 'event-detail-desktop', path: '/event/void-techno-saturday', viewport: { width: 1280, height: 900 } },
  { name: 'bottom-nav-mobile', path: '/search', viewport: { width: 390, height: 844 } },
];

const browser = await chromium.launch();

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    colorScheme: shot.dark ? 'dark' : 'light',
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`), fullPage: shot.name.includes('detail') });
  await context.close();
  console.log(`saved ${shot.name}.png`);
}

await browser.close();
