import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';

import type { TicketExtractionResult } from './types';

const PROMOTIONAL_URL_PATTERN =
  /bit\.ly|snash\.com|merchandise|bootshaus-app|facebook\.com|instagram\.com|spotify\.com/i;

const HTML_CTA_ANCHOR_PATTERNS = [
  /<a[^>]*class="[^"]*(?:nav-ticket|ticket-btn|buy-ticket|event-ticket|ecm-event-single__ticket-button)[^"]*"[^>]*href=["']([^"']+)["']/gi,
  /<a[^>]*href=["']([^"']+)["'][^>]*class="[^"]*(?:nav-ticket|ticket-btn|buy-ticket|event-ticket|ecm-event-single__ticket-button)[^"]*"/gi,
  /<a[^>]*href=["']([^"']*\.ticket\.io\/[A-Za-z0-9]+[^"']*)["'][^>]*>/gi,
  /<a[^>]*href=["']([^"']*ticketkings\.de\/event\/[^"']+)["'][^>]*>/gi,
];

function isTicketDestinationUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || PROMOTIONAL_URL_PATTERN.test(trimmed)) {
    return false;
  }
  return /\.ticket\.io\/[A-Za-z0-9]+|ticketkings\.de\/event\//i.test(trimmed);
}

function normalizeTicketUrl(url: string, baseUrl?: string): string {
  const decoded = url.replace(/&amp;/g, '&').trim();
  if (/^https?:\/\//i.test(decoded)) {
    return decoded;
  }
  if (baseUrl) {
    try {
      return new URL(decoded, baseUrl).href;
    } catch {
      return decoded;
    }
  }
  return decoded;
}

function extractHtmlTicketCta(html: string, baseUrl?: string): string | undefined {
  const decoded = html.replace(/&amp;/g, '&');
  const candidates: string[] = [];
  for (const pattern of HTML_CTA_ANCHOR_PATTERNS) {
    let match: RegExpExecArray | null;
    const flags = pattern.flags.includes('g') ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
    while ((match = flags.exec(decoded)) !== null) {
      const raw = match[1];
      if (!raw) continue;
      const url = normalizeTicketUrl(raw, baseUrl);
      if (isTicketDestinationUrl(url)) {
        candidates.push(url);
      }
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }
  if (baseUrl) {
    const pagePath = normalizeTicketUrl(baseUrl).replace(/\/$/, '').toLowerCase();
    const samePage = candidates.find((url) => url.replace(/\/$/, '').toLowerCase() === pagePath);
    if (samePage) {
      return samePage;
    }
  }
  return candidates[0];
}

function extractJsonLdTicketUrl(html: string, baseUrl?: string): string | undefined {
  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const parsed = parseJsonLdEvent(node, baseUrl);
      const url = parsed.fields.ticketUrl;
      if (typeof url === 'string' && isTicketDestinationUrl(url)) {
        return normalizeTicketUrl(url, baseUrl);
      }
    }
  }
  return undefined;
}

/**
 * Ticket URL priority: explicit HTML CTA > JSON-LD Offer.
 * Never derives from descriptive prose or promotional links.
 */
export function extractTicketUrl(html: string, baseUrl?: string): TicketExtractionResult {
  const rejectedPromotional: string[] = [];

  const htmlCta = extractHtmlTicketCta(html, baseUrl);
  if (htmlCta) {
    return { url: htmlCta, strategy: 'html_ticket_cta' };
  }

  const jsonLdUrl = extractJsonLdTicketUrl(html, baseUrl);
  if (jsonLdUrl) {
    return { url: jsonLdUrl, strategy: 'json_ld_offer' };
  }

  if (baseUrl && /ticketkings\.de\/event\/[^/]+/i.test(baseUrl)) {
    const canonical = baseUrl.replace(/\/$/, '') + '/';
    if (isTicketDestinationUrl(canonical)) {
      return { url: canonical, strategy: 'structured_embed' };
    }
  }

  for (const pattern of HTML_CTA_ANCHOR_PATTERNS) {
    let match: RegExpExecArray | null;
    const flags = pattern.flags.includes('g') ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
    while ((match = flags.exec(html)) !== null) {
      const raw = match[1];
      if (raw && PROMOTIONAL_URL_PATTERN.test(raw)) {
        rejectedPromotional.push(raw);
      }
    }
  }

  return {
    strategy: 'none',
    rejectedPromotional: rejectedPromotional.length > 0 ? [...new Set(rejectedPromotional)] : undefined,
  };
}
