import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8091';
const OUT_DIR = join(process.cwd(), 'docs/visual-qa/events-discovery-grid');

mkdirSync(OUT_DIR, { recursive: true });

const shots = [
  { name: 'grid-mobile-light', path: '/search', viewport: { width: 390, height: 844 } },
  { name: 'grid-mobile-dark', path: '/search', viewport: { width: 390, height: 844 }, dark: true },
  { name: 'grid-map-toggle-mobile', path: '/search', viewport: { width: 390, height: 844 } },
  { name: 'map-mobile-light', path: '/search?view=map', viewport: { width: 390, height: 844 } },
  { name: 'grid-desktop-light', path: '/search', viewport: { width: 1280, height: 900 } },
  { name: 'design-preview-grid', path: '/design-preview', viewport: { width: 1280, height: 900 } },
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
  await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`), fullPage: shot.name.includes('design-preview') });
  await context.close();
  console.log(`saved ${shot.name}.png`);
}

await browser.close();
