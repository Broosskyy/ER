import type { ConnectorOutput } from './event-evidence';
import {
  parseDetailEvidenceFromHtml,
  type DetailEvidenceRequest,
} from './detail-evidence-parser';
import { DetailFetchCache, normalizeDetailUrl } from './detail-fetch-cache';
import type { DetailFetch } from './detail-fetch';

export interface DetailEvidenceServiceOptions {
  fetch?: DetailFetch;
  embeddedHtmlByUrl?: Map<string, string>;
}

export class DetailEvidenceService {
  private readonly resultCache = new DetailFetchCache<ConnectorOutput>();
  private readonly embeddedHtmlByUrl: Map<string, string>;
  private readonly fetch?: DetailFetch;

  constructor(options: DetailEvidenceServiceOptions = {}) {
    this.fetch = options.fetch;
    this.embeddedHtmlByUrl = new Map(
      [...(options.embeddedHtmlByUrl ?? new Map())].map(([url, html]) => [
        normalizeDetailUrl(url),
        html,
      ]),
    );
  }

  registerEmbeddedHtml(url: string, html: string): void {
    this.embeddedHtmlByUrl.set(normalizeDetailUrl(url), html);
  }

  async resolve(
    request: Omit<DetailEvidenceRequest, 'html'> & { html?: string },
    options: { allowHttp?: boolean } = {},
  ): Promise<ConnectorOutput> {
    const cached = this.resultCache.get(request.sourceUrl);
    if (cached) {
      return cached;
    }

    const embedded =
      request.html ?? this.embeddedHtmlByUrl.get(normalizeDetailUrl(request.sourceUrl));
    if (embedded) {
      const parsed = parseDetailEvidenceFromHtml({ ...request, html: embedded });
      parsed.diagnostics = [...(parsed.diagnostics ?? []), 'embedded_html_reused'];
      this.resultCache.set(request.sourceUrl, parsed);
      return parsed;
    }

    if (!this.fetch || options.allowHttp !== true) {
      return {
        sourceId: request.sourceId,
        sourceFamily: request.sourceFamily,
        sourceUrl: request.sourceUrl,
        verifiedAt: request.verifiedAt,
        diagnostics: ['detail_unavailable:no_embedded_html'],
      };
    }

    const fetched = await this.fetch(request.sourceUrl);
    if (!fetched.html || fetched.status !== 'ok') {
      const failed: ConnectorOutput = {
        sourceId: request.sourceId,
        sourceFamily: request.sourceFamily,
        sourceUrl: request.sourceUrl,
        verifiedAt: request.verifiedAt,
        diagnostics: [`detail_fetch:${fetched.status}`],
      };
      this.resultCache.set(request.sourceUrl, failed);
      return failed;
    }

    const parsed = parseDetailEvidenceFromHtml({ ...request, html: fetched.html });
    parsed.diagnostics = [...(parsed.diagnostics ?? []), 'detail_fetch:ok'];
    this.resultCache.set(request.sourceUrl, parsed);
    return parsed;
  }

  getCacheHits(): number {
    return this.resultCache.getHitCount();
  }
}
