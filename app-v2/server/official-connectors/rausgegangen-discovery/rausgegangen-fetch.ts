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
  requestDelayMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

let lastRequestAt = 0;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
  if (cacheDir) {
    const cached = readCache(cacheDir, url);
    if (cached != null) {
      return { ok: true, status: 200, html: cached, finalUrl: url, fromCache: true };
    }
  }

  const delay = options.requestDelayMs ?? DEFAULT_DISCOVERY_BOUNDS.requestDelayMs;
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < delay) {
    await sleep(delay - sinceLast);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_DISCOVERY_BOUNDS.fetchTimeoutMs;
  const maxRetries = options.maxRetries ?? DEFAULT_DISCOVERY_BOUNDS.maxRetries;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
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
      if (cacheDir && response.ok) {
        writeCache(cacheDir, url, html);
      }
      return {
        ok: response.ok,
        status: response.status,
        html,
        finalUrl: response.url,
        fromCache: false,
        error: response.ok ? undefined : `http_${response.status}`,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxRetries) {
        await sleep(delay * (attempt + 1));
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
