import type { DetailEvidenceRequest, DetailEvidenceResult, DetailFetchMetrics } from './detail-evidence-types';
import { DetailFetchCache } from './detail-fetch-cache';
import { parseDetailEvidenceFromHtml } from './detail-evidence-parser';

export type DetailFetchFn = (url: string) => Promise<{
  html?: string;
  status: number;
  error?: string;
}>;

export interface DetailEvidenceServiceOptions {
  fetchFn?: DetailFetchFn;
  globalConcurrency?: number;
  perHostConcurrency?: number;
  timeoutMs?: number;
  embeddedHtmlByUrl?: Map<string, string>;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_GLOBAL_CONCURRENCY = 6;
const DEFAULT_PER_HOST_CONCURRENCY = 2;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

class FetchConcurrencyGate {
  private readonly globalLimit: number;
  private readonly perHostLimit: number;
  private globalActive = 0;
  private readonly hostActive = new Map<string, number>();
  private readonly waiters: Array<() => void> = [];

  constructor(globalLimit: number, perHostLimit: number) {
    this.globalLimit = globalLimit;
    this.perHostLimit = perHostLimit;
  }

  private notify(): void {
    while (this.waiters.length > 0) {
      const next = this.waiters[0];
      if (!next) break;
      if (this.canAcquire()) {
        this.waiters.shift();
        next();
      } else {
        break;
      }
    }
  }

  private canAcquireForHost(host: string): boolean {
    return (this.hostActive.get(host) ?? 0) < this.perHostLimit;
  }

  private canAcquire(): boolean {
    return this.globalActive < this.globalLimit;
  }

  async acquire(host: string): Promise<void> {
    while (!this.canAcquire() || !this.canAcquireForHost(host)) {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
    this.globalActive += 1;
    this.hostActive.set(host, (this.hostActive.get(host) ?? 0) + 1);
  }

  release(host: string): void {
    this.globalActive = Math.max(0, this.globalActive - 1);
    const current = this.hostActive.get(host) ?? 0;
    if (current <= 1) {
      this.hostActive.delete(host);
    } else {
      this.hostActive.set(host, current - 1);
    }
    this.notify();
  }
}

export class DetailEvidenceService {
  private readonly resultCache = new DetailFetchCache<DetailEvidenceResult>();
  private readonly htmlCache = new DetailFetchCache<string>();
  private readonly embeddedHtmlByUrl: Map<string, string>;
  private readonly fetchFn?: DetailFetchFn;
  private readonly timeoutMs: number;
  private readonly gate: FetchConcurrencyGate | undefined;
  private executedRequests = 0;
  private httpRetries = 0;
  private embeddedHtmlHits = 0;
  private successfulFetches = 0;
  private powChallenges = 0;
  private timeouts = 0;
  private httpErrors = 0;
  private unusableContent = 0;
  private readonly startedAt = Date.now();
  private readonly uniqueUrls = new Set<string>();

  constructor(private readonly options: DetailEvidenceServiceOptions = {}) {
    this.embeddedHtmlByUrl = options.embeddedHtmlByUrl ?? new Map();
    this.fetchFn = options.fetchFn;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (this.fetchFn) {
      this.gate = new FetchConcurrencyGate(
        options.globalConcurrency ?? DEFAULT_GLOBAL_CONCURRENCY,
        options.perHostConcurrency ?? DEFAULT_PER_HOST_CONCURRENCY,
      );
    }
  }

  registerEmbeddedHtml(url: string, html: string): void {
    this.embeddedHtmlByUrl.set(url, html);
  }

  hasResolved(url: string): boolean {
    return this.resultCache.has(url);
  }

  async resolve(
    request: DetailEvidenceRequest,
    options?: { allowHttp?: boolean },
  ): Promise<DetailEvidenceResult> {
    const url = request.eventUrl;
    this.uniqueUrls.add(url);

    const cached = this.resultCache.get(url);
    if (cached) {
      return cached;
    }

    const embedded = this.embeddedHtmlByUrl.get(url);
    if (embedded) {
      this.embeddedHtmlHits += 1;
      const observedAt = new Date().toISOString();
      const parsed = parseDetailEvidenceFromHtml(request, embedded, observedAt);
      parsed.diagnostics = [...parsed.diagnostics, 'embedded_html_hit'];
      if (parsed.fetchStatus === 'ok') {
        parsed.verifiedAt = observedAt;
      }
      this.resultCache.set(url, parsed);
      this.trackStatus(parsed);
      return parsed;
    }

    if (!this.fetchFn || options?.allowHttp === false) {
      const missing: DetailEvidenceResult = {
        sourceId: request.sourceId,
        eventUrl: url,
        observedAt: new Date().toISOString(),
        fetchStatus: 'content_unusable',
        diagnostics: ['no_embedded_html_and_no_fetch'],
      };
      return missing;
    }

    const html = await this.fetchHtml(url);
    if (!html) {
      const failed: DetailEvidenceResult = {
        sourceId: request.sourceId,
        eventUrl: url,
        observedAt: new Date().toISOString(),
        fetchStatus: 'http_error',
        diagnostics: ['http_fetch_failed'],
      };
      this.resultCache.set(url, failed);
      this.trackStatus(failed);
      return failed;
    }

    const observedAt = new Date().toISOString();
    const parsed = parseDetailEvidenceFromHtml(request, html, observedAt);
    parsed.diagnostics = [...parsed.diagnostics, 'http_fetch'];
    if (parsed.fetchStatus === 'ok') {
      parsed.verifiedAt = observedAt;
    }
    this.resultCache.set(url, parsed);
    this.trackStatus(parsed);
    return parsed;
  }

  private async fetchHtml(url: string): Promise<string | undefined> {
    const cachedHtml = this.htmlCache.get(url);
    if (cachedHtml) {
      return cachedHtml;
    }

    const host = hostOf(url);
    const gate = this.gate;
    if (gate) {
      await gate.acquire(host);
    }

    try {
      const fetched = await this.fetchWithRetry(url);
      if (fetched.html) {
        this.htmlCache.set(url, fetched.html);
        return fetched.html;
      }
      if (fetched.error === 'timeout') {
        this.timeouts += 1;
      } else {
        this.httpErrors += 1;
      }
      return undefined;
    } finally {
      if (gate) {
        gate.release(host);
      }
    }
  }

  private async fetchWithRetry(url: string): Promise<{ html?: string; status: number; error?: string }> {
    this.executedRequests += 1;
    const first = await this.fetchFn!(url);
    if (first.status === 404) {
      return first;
    }
    if (first.html || first.status < 500) {
      return first;
    }
    this.httpRetries += 1;
    this.executedRequests += 1;
    return await this.fetchFn!(url);
  }

  private trackStatus(result: DetailEvidenceResult): void {
    if (result.fetchStatus === 'ok') {
      this.successfulFetches += 1;
    } else if (result.fetchStatus === 'pow_challenge') {
      this.powChallenges += 1;
    } else if (result.fetchStatus === 'timeout') {
      this.timeouts += 1;
    } else if (result.fetchStatus === 'http_error' || result.fetchStatus === 'not_found') {
      this.httpErrors += 1;
    } else if (result.fetchStatus === 'content_unusable') {
      this.unusableContent += 1;
    }
  }

  getMetrics(): DetailFetchMetrics {
    return {
      uniqueDetailUrls: this.uniqueUrls.size,
      embeddedHtmlHits: this.embeddedHtmlHits,
      cacheHits: this.resultCache.getCacheHits() + this.htmlCache.getCacheHits(),
      executedRequests: this.executedRequests,
      httpRetries: this.httpRetries,
      successfulFetches: this.successfulFetches,
      powChallenges: this.powChallenges,
      timeouts: this.timeouts,
      httpErrors: this.httpErrors,
      unusableContent: this.unusableContent,
      elapsedMs: Date.now() - this.startedAt,
    };
  }
}
