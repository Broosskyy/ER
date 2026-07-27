import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8091';
const OUT_DIR = join(process.cwd(), 'docs/visual-qa/admin-review-final');

mkdirSync(OUT_DIR, { recursive: true });

const shots = [
  { name: 'admin-dashboard-desktop-light', path: '/admin', viewport: { width: 1280, height: 900 } },
  { name: 'admin-pending-desktop-light', path: '/admin/events/review?filter=pending', viewport: { width: 1280, height: 900 } },
  { name: 'admin-review-desktop-light', path: '/admin/events/review', viewport: { width: 1280, height: 900 } },
  { name: 'admin-sources-desktop-light', path: '/admin/sources', viewport: { width: 1280, height: 900 } },
  { name: 'admin-dashboard-mobile-light', path: '/admin', viewport: { width: 390, height: 844 } },
  { name: 'admin-dashboard-mobile-dark', path: '/admin', viewport: { width: 390, height: 844 }, dark: true },
  { name: 'admin-pending-mobile-light', path: '/admin/events/review?filter=pending', viewport: { width: 390, height: 844 } },
  { name: 'admin-sources-mobile-light', path: '/admin/sources', viewport: { width: 390, height: 844 } },
  { name: 'admin-dashboard-tablet-light', path: '/admin', viewport: { width: 834, height: 1112 } },
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
