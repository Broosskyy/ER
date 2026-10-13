import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { DEFAULT_DISCOVERY_BOUNDS, RAUSGEGANGEN_DISCOVERY_USER_AGENT } from './constants';

export interface FetchResult {
  ok: boolean;
  status: number;
  html: string;
  finalUrl: string;
  fromCache: boolean;
  error?: string;
}

export interface RausgegangenFetchOptions {
  cacheDir?: string;
  skipCache?: boolean;
  requestDelayMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

let lastRequestAt = 0;

const RETRYABLE_HTTP_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRequestSlot(delayMs: number): Promise<void> {
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < delayMs) {
    await sleep(delayMs - sinceLast);
  }
}

function parseRetryAfterMs(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const seconds = Number.parseInt(raw, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(raw);
  if (!Number.isFinite(dateMs)) {
    return undefined;
  }
  return Math.max(0, dateMs - Date.now());
}

function httpRetryDelayMs(
  response: Response,
  attempt: number,
  requestDelayMs: number,
): number {
  const retryAfter = parseRetryAfterMs(response.headers.get('retry-after')) ?? 0;
  const exponential = Math.max(5000, requestDelayMs * 4 * 2 ** attempt);
  return Math.min(60000, Math.max(retryAfter, exponential));
}

function cacheKey(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

function readCache(cacheDir: string, url: string): string | null {
  const path = join(cacheDir, `${cacheKey(url)}.html`);
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, 'utf8');
}

function writeCache(cacheDir: string, url: string, html: string): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, `${cacheKey(url)}.html`), html, 'utf8');
}

export async function fetchRausgegangenHtml(
  url: string,
  options: RausgegangenFetchOptions = {},
): Promise<FetchResult> {
  const cacheDir = options.cacheDir;
  if (cacheDir && !options.skipCache) {
    const cached = readCache(cacheDir, url);
    if (cached != null) {
      return { ok: true, status: 200, html: cached, finalUrl: url, fromCache: true };
    }
  }

  const delay = options.requestDelayMs ?? DEFAULT_DISCOVERY_BOUNDS.requestDelayMs;
  const timeoutMs = options.timeoutMs ?? DEFAULT_DISCOVERY_BOUNDS.fetchTimeoutMs;
  const maxRetries = options.maxRetries ?? DEFAULT_DISCOVERY_BOUNDS.maxRetries;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    await waitForRequestSlot(delay);
    lastRequestAt = Date.now();
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': RAUSGEGANGEN_DISCOVERY_USER_AGENT,
          Accept: 'text/html,application/xml,application/json',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const html = await response.text();
      if (response.ok) {
        if (cacheDir) {
          writeCache(cacheDir, url, html);
        }
        return {
          ok: true,
          status: response.status,
          html,
          finalUrl: response.url,
          fromCache: false,
        };
      }

      lastError = `http_${response.status}`;
      if (attempt < maxRetries && RETRYABLE_HTTP_STATUSES.has(response.status)) {
        await sleep(httpRetryDelayMs(response, attempt, delay));
        continue;
      }

      return {
        ok: false,
        status: response.status,
        html,
        finalUrl: response.url,
        fromCache: false,
        error: lastError,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxRetries) {
        await sleep(Math.max(1000, delay * (attempt + 1)));
      }
    }
  }

  return {
    ok: false,
    status: 0,
    html: '',
    finalUrl: url,
    fromCache: false,
    error: lastError ?? 'fetch_failed',
  };
}
