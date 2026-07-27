import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:8091';
const output = join(process.cwd(), 'docs/visual-qa/source-management-scale');
const adminEmail = process.env.QA_ADMIN_EMAIL ?? 'admin@eternalrave.app';
const adminPassword = process.env.QA_ADMIN_PASSWORD ?? 'admin-local-dev';
const qaReviewEventId = 'qa-capture-review-event';
const contributorStorageKey = 'app.contributorEvents.v1';

mkdirSync(output, { recursive: true });

const captures = [
  ['sources-overview-desktop-light', '/admin/sources', { width: 1280, height: 900 }, 'light'],
  ['sources-overview-mobile-light', '/admin/sources', { width: 390, height: 844 }, 'light'],
  ['sources-overview-desktop-dark', '/admin/sources', { width: 1280, height: 900 }, 'dark'],
  ['source-detail-desktop-light', '/admin/sources/demo', { width: 1280, height: 900 }, 'light'],
  [
    'duplicate-review-desktop-light',
    `/admin/events/review/${qaReviewEventId}/duplicates`,
    { width: 1280, height: 900 },
    'light',
  ],
  [
    'conflict-review-desktop-light',
    `/admin/events/review/${qaReviewEventId}/conflicts`,
    { width: 1280, height: 900 },
    'light',
  ],
];

function buildQaContributorEvent() {
  const now = new Date().toISOString();
  return {
    id: qaReviewEventId,
    title: 'QA Capture Review Event',
    description: 'Seeded contributor event for visual QA capture.',
    status: 'review',
    createdBy: 'qa-contributor',
    startDate: '2026-09-12T23:00:00.000Z',
    venueName: 'Warehouse',
    genreId: 'techno',
    createdAt: now,
    updatedAt: now,
  };
}

async function seedQaContributorEvent(page) {
  const event = buildQaContributorEvent();
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ key, seededEvent }) => {
      localStorage.setItem(key, JSON.stringify([seededEvent]));
    },
    { key: contributorStorageKey, seededEvent: event },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function loginAsAdmin(page, returnPath) {
  const returnTo = encodeURIComponent(returnPath);
  await page.goto(`${baseUrl}/login?returnTo=${returnTo}`, { waitUntil: 'domcontentloaded' });
  await page.locator('input').nth(0).fill(adminEmail);
  await page.locator('input').nth(1).fill(adminPassword);
  await page.getByRole('button', { name: /anmelden|sign in|log in/i }).click();
  await page.waitForURL((url) => url.pathname === returnPath, { timeout: 30_000 });
}

async function assertAuthenticatedAdminRoute(page, path) {
  const url = page.url();
  if (url.includes('/login')) {
    throw new Error(`Capture redirected to login for ${path}: ${url}`);
  }
  if (!url.includes('/admin/')) {
    throw new Error(`Expected admin route for ${path}, got ${url}`);
  }
}

async function waitForRouteContent(page, path) {
  if (path === '/admin/sources') {
    await page.getByText('Quellen').first().waitFor({ timeout: 20_000 });
    return;
  }

  if (path.startsWith('/admin/sources/')) {
    await page.getByText('Multi-Source Status').first().waitFor({ timeout: 20_000 });
    return;
  }

  if (path.endsWith('/duplicates')) {
    await page.getByText('Dublettenprüfung').first().waitFor({ timeout: 20_000 });
    return;
  }

  if (path.endsWith('/conflicts')) {
    await page.getByText('Konfliktprüfung').first().waitFor({ timeout: 20_000 });
    return;
  }

  throw new Error(`No wait strategy for route: ${path}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await seedQaContributorEvent(page);

  for (const [name, path, viewport, colorScheme] of captures) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme });
    await loginAsAdmin(page, path);
    await page.waitForTimeout(2_000);
    await waitForRouteContent(page, path);
    await assertAuthenticatedAdminRoute(page, path);
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: false });
    console.log(`saved ${name}.png -> ${path}`);
  }
} finally {
  await browser.close();
}
