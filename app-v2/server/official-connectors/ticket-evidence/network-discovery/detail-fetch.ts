import { createPlaywrightTicketBrowserOps } from '../create-playwright-ticket-browser-ops';
import { fetchTicketPage } from '../fetch-ticket-page';
import { parseTicketIoDetailDom } from '../parse-ticket-io-detail-dom';
import { isTicketProviderBlockedBody } from '../safe-fetch-ticket';
import type { DetailAccessStatus } from './detail-types';

export interface DetailFetchResult {
  html: string;
  finalUrl: string;
  fetchMethod: 'fetch' | 'playwright' | 'none';
  fetchStatus?: number;
  detailAccess: DetailAccessStatus;
  blocked: boolean;
  contentFingerprint?: string;
}

let browserOps: ReturnType<typeof createPlaywrightTicketBrowserOps> | undefined;

function getBrowserOps() {
  if (!browserOps) {
    browserOps = createPlaywrightTicketBrowserOps({ ticketPageWaitMs: 2000 });
  }
  return browserOps;
}

function classifyAccess(html: string, contentType: string, finalUrl: string): DetailAccessStatus {
  if (!html.trim()) {
    return 'DETAIL_NOT_FOUND';
  }
  const dom = parseTicketIoDetailDom(html, { sourceUrl: finalUrl });
  if (dom && dom.offers.length > 0) {
    return 'DETAIL_ACCESSIBLE';
  }
  if (dom) {
    return 'PARTIAL_DETAIL';
  }
  if (isTicketProviderBlockedBody(html, contentType)) {
    return 'BLOCKED_BY_SECURITY';
  }
  return html.length > 500 ? 'PARTIAL_DETAIL' : 'PROVIDER_ACCESS_UNAVAILABLE';
}

export async function fetchTicketIoEventDetail(url: string): Promise<DetailFetchResult> {
  try {
    const raw = await fetchTicketPage(url);
    let html = raw.body ?? '';
    let finalUrl = raw.finalUrl || url;
    let fetchMethod: DetailFetchResult['fetchMethod'] = 'fetch';
    let fingerprint = raw.fingerprint;

    let detailAccess = classifyAccess(html, raw.contentType, finalUrl);
    const needsBrowser =
      detailAccess === 'BLOCKED_BY_SECURITY' ||
      detailAccess === 'PROVIDER_ACCESS_UNAVAILABLE' ||
      detailAccess === 'DETAIL_NOT_FOUND';

    if (needsBrowser) {
      try {
        const rendered = await getBrowserOps().fetchTicketPage(url);
        if (rendered.body) {
          html = rendered.body;
          finalUrl = rendered.finalUrl || url;
          fingerprint = rendered.fingerprint;
          fetchMethod = 'playwright';
          detailAccess = classifyAccess(html, rendered.contentType, finalUrl);
        }
      } catch {
        // keep fetch result classification
      }
    }

    return {
      html,
      finalUrl,
      fetchMethod: html ? fetchMethod : 'none',
      detailAccess,
      blocked: isTicketProviderBlockedBody(html, 'text/html') && detailAccess !== 'DETAIL_ACCESSIBLE',
      contentFingerprint: fingerprint,
    };
  } catch {
    return {
      html: '',
      finalUrl: url,
      fetchMethod: 'none',
      detailAccess: 'PROVIDER_ACCESS_UNAVAILABLE',
      blocked: true,
    };
  }
}

export async function closeDetailFetchBrowser(): Promise<void> {
  if (browserOps) {
    await browserOps.close();
    browserOps = undefined;
  }
}
