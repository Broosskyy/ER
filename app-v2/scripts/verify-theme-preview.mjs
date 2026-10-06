import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

const BASE_URL = process.env.THEME_PREVIEW_BASE_URL ?? 'http://localhost:8081';
const OUT_DIR = path.join(process.cwd(), '.verify-screenshots', 'theme-preview');

const VIEWPORTS = [
  { name: 'mobile-360x800', width: 360, height: 800 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
];

async function setThemeMode(page, mode) {
  const button = page.getByText(mode, { exact: true });
  await button.click();
  await page.waitForTimeout(250);
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
    for (const mode of ['Light', 'Dark']) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });

      await page.goto(`${BASE_URL}/design-preview`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      const bodyText = await page.locator('body').innerText();
      if (!bodyText.includes('Theme Preview')) {
        await page.screenshot({ path: path.join(OUT_DIR, `debug-${viewport.name}.png`), fullPage: true });
        throw new Error(`Theme Preview not rendered. Body starts with: ${bodyText.slice(0, 200)}`);
      }
      await page.getByText('Light', { exact: true }).waitFor({ timeout: 30000 });
      await setThemeMode(page, mode);
      await assertNoHorizontalOverflow(page);

      await page.screenshot({
        path: path.join(OUT_DIR, `${viewport.name}-${mode.toLowerCase()}.png`),
        fullPage: true,
      });

      await page.close();
    }
  }

  await browser.close();
  console.log(`Theme preview screenshots saved to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
