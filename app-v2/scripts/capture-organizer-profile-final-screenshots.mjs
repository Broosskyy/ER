import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8091';
const OUT_DIR = join(process.cwd(), 'docs/visual-qa/organizer-profile-final');

mkdirSync(OUT_DIR, { recursive: true });

const shots = [
  { name: 'organizer-profile-mobile-light', path: '/profile/organizer', viewport: { width: 390, height: 844 } },
  { name: 'organizer-profile-edit-mobile-light', path: '/profile/organizer/edit', viewport: { width: 390, height: 844 } },
  { name: 'my-events-mobile-light', path: '/profile/events', viewport: { width: 390, height: 844 } },
  { name: 'my-events-draft-mobile-light', path: '/profile/events', viewport: { width: 390, height: 844 } },
  { name: 'submission-status-mobile-light', path: '/create/event/status/demo-submission', viewport: { width: 390, height: 844 } },
  { name: 'organizer-profile-mobile-dark', path: '/profile/organizer', viewport: { width: 390, height: 844 }, dark: true },
  { name: 'my-events-mobile-dark', path: '/profile/events', viewport: { width: 390, height: 844 }, dark: true },
  { name: 'organizer-profile-desktop-light', path: '/profile/organizer', viewport: { width: 1280, height: 900 } },
  { name: 'my-events-desktop-light', path: '/profile/events', viewport: { width: 1280, height: 900 } },
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
