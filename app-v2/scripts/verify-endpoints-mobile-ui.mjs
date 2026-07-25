import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.ADMIN_UI_BASE_URL ?? 'http://localhost:8081';
const OUT_DIR = path.join(process.cwd(), '.verify-screenshots', 'endpoints-mobile');

const VIEWPORTS = [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-360x800', width: 360, height: 800 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
];

async function login(page) {
  await page.goto(`${BASE_URL}/login?returnTo=%2Fadmin%2Fsources%2Fdemo`, { waitUntil: 'networkidle' });
  await page.locator('input').nth(0).fill('admin@eternalrave.app');
  await page.locator('input').nth(1).fill('admin-local-dev');
  await page.getByRole('button', { name: /sign in|log in|anmelden|einloggen/i }).click();
  await page.waitForURL(/sources\/demo/, { timeout: 25000 });
  await page.getByLabel('Endpoints-Verwaltung').waitFor({ timeout: 25000 });
  await page.getByText('Events listing page').waitFor({ timeout: 15000 });
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  if (overflow) {
    throw new Error('Horizontal page overflow detected');
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await login(page);
    await assertNoHorizontalOverflow(page);

    const endpoints = page.getByLabel('Endpoints-Verwaltung');
    await endpoints.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(OUT_DIR, `${viewport.name}-01-endpoints-section.png`),
      fullPage: false,
    });

    if (viewport.width < 1024) {
      await page.getByRole('button', { name: /Endpoint hinzufügen/i }).click();
      await page.getByText('Endpoint hinzufügen', { exact: true }).first().waitFor({ timeout: 10000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `${viewport.name}-02-add-dialog.png`),
        fullPage: false,
      });
      await page.getByRole('button', { name: /^Abbrechen$/i }).click();
    }

    await page.getByRole('button', { name: /^Save$/i }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(OUT_DIR, `${viewport.name}-03-source-actions.png`),
      fullPage: false,
    });

    await assertNoHorizontalOverflow(page);
    await page.close();
  }

  await browser.close();
  console.log(`Screenshots saved to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
