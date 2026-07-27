import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8091';
const OUT_DIR = join(process.cwd(), 'docs/visual-qa/map-discovery-location-filter-final');

mkdirSync(OUT_DIR, { recursive: true });

const shots = [
  { name: 'map-events-mobile-standard', path: '/search?view=map', viewport: { width: 390, height: 844 } },
  { name: 'map-route-mobile-standard', path: '/map', viewport: { width: 390, height: 844 } },
  { name: 'map-desktop-standard', path: '/search?view=map', viewport: { width: 1280, height: 900 } },
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
  await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`), fullPage: false });
  await context.close();
  console.log(`saved ${shot.name}.png`);
}

await browser.close();
