import { createHash } from 'node:crypto';
import { chromium, type Browser, type BrowserContext } from 'playwright';

import { fetchTicketPage } from './fetch-ticket-page';
import type { TicketBrowserOps, OfficialPageCaptureResult } from './ticket-browser-ops';
import { parseTicketIoDetailDom } from './parse-ticket-io-detail-dom';
import type { TicketFetchResult } from './types';
import { isProviderPageReady, classifyProviderPageReadiness } from './page-readiness';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fingerprintBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

function ticketPageHasRecoverableProducts(body: string): boolean {
  if (!body) {
    return false;
  }
  const domEvidence = parseTicketIoDetailDom(body);
  return Boolean(domEvidence && domEvidence.offers.length > 0);
}

function rawTicketPageIsUsable(result: TicketFetchResult): boolean {
  if (!result.body || result.blocked) {
    return false;
  }
  if (!isProviderPageReady(classifyProviderPageReadiness(result.body, result.contentType))) {
    return false;
  }
  return ticketPageHasRecoverableProducts(result.body);
}

export interface PlaywrightTicketBrowserOpsOptions {
  ticketPageWaitMs?: number;
}

export function createPlaywrightTicketBrowserOps(
  options: PlaywrightTicketBrowserOpsOptions = {},
): TicketBrowserOps {
  const ticketPageWaitMs = options.ticketPageWaitMs ?? 2_000;
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let fetchChain: Promise<unknown> = Promise.resolve();

  async function ensureContext(): Promise<BrowserContext> {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }
    if (!context) {
      context = await browser.newContext({
        userAgent: USER_AGENT,
        locale: 'de-DE',
        extraHTTPHeaders: {
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
      });
    }
    return context;
  }

  return {
    async captureOfficialEventPage(url: string): Promise<OfficialPageCaptureResult> {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
      });
      const html = await response.text();
      return {
        html,
        finalUrl: response.url || url,
        contentFingerprint: fingerprintBody(html),
      };
    },

    async fetchTicketPage(url: string): Promise<TicketFetchResult> {
      const runFetch = async (): Promise<TicketFetchResult> => {
        const rawResult = await fetchTicketPage(url);
        if (rawTicketPageIsUsable(rawResult)) {
          return rawResult;
        }

        const pageContext = await ensureContext();
        const page = await pageContext.newPage();
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
          await page
            .waitForSelector(
              'select.ticketCount, #ticket-event-data, .ticket-price-value, script[type="application/ld+json"]',
              {
                timeout: 20_000,
              },
            )
            .catch(() => undefined);
          await page.waitForTimeout(ticketPageWaitMs);
          const body = await page.content();
          const finalUrl = page.url();
          const fingerprint = fingerprintBody(body);
          const blocked = !ticketPageHasRecoverableProducts(body);
          return {
            finalUrl,
            body,
            contentType: 'text/html',
            fingerprint,
            blocked,
            blockReason: blocked ? 'bot_protection' : undefined,
            redirectChain: rawResult.redirectChain.length > 0 ? rawResult.redirectChain : [url],
          };
        } finally {
          await page.close();
        }
      };

      const queued = fetchChain.then(runFetch, runFetch);
      fetchChain = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    },

    async close(): Promise<void> {
      await context?.close();
      await browser?.close();
      context = undefined;
      browser = undefined;
    },
  };
}
