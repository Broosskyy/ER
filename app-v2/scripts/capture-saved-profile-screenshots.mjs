import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8091';
const OUT_DIR = join(process.cwd(), 'docs/visual-qa/saved-profile-final');

mkdirSync(OUT_DIR, { recursive: true });

const shots = [
  { name: 'saved-empty-mobile-light', path: '/saved', viewport: { width: 390, height: 844 } },
  { name: 'saved-with-events-mobile-light', path: '/saved?demo=saved', viewport: { width: 390, height: 844 } },
  { name: 'saved-mobile-dark', path: '/saved', viewport: { width: 390, height: 844 }, dark: true },
  { name: 'profile-guest-mobile-light', path: '/profile', viewport: { width: 390, height: 844 } },
  { name: 'profile-edit-mobile-light', path: '/profile/edit', viewport: { width: 390, height: 844 } },
  { name: 'settings-overview-mobile-light', path: '/settings/index', viewport: { width: 390, height: 844 } },
  { name: 'activity-empty-mobile-light', path: '/activity', viewport: { width: 390, height: 844 } },
  { name: 'organizer-entry-mobile-light', path: '/create', viewport: { width: 390, height: 844 } },
  { name: 'saved-desktop-light', path: '/saved', viewport: { width: 1280, height: 900 } },
  { name: 'profile-desktop-light', path: '/profile', viewport: { width: 1280, height: 900 } },
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
