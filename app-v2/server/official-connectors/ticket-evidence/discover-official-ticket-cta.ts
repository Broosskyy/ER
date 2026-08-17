import * as cheerio from 'cheerio';

import {
  isFourvenuesEventDetailUrl,
  isMerchandiseUrl,
  isPaylogicEventDetailUrl,
  isShopRootUrl,
  isTicketIoEventDetailUrl,
  isTicketIoShopRootUrl,
  isTicketKingsHost,
} from './url-policy';

const TICKET_CTA_TEXT_PATTERN =
  /\b(?:tickets?|ticket\s*kaufen|jetzt\s+kaufen|buy\s+tickets?|vorverkauf|get\s+tickets?|eintritt)\b/i;
const NON_TICKET_CTA_PATTERN =
  /\b(?:merch|merchandise|newsletter|shop|kollektion|facebook|instagram|youtube|spotify)\b/i;

function normalizeCtaText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function textHasTicketCtaSemantics(text: string): boolean {
  const normalized = normalizeCtaText(text);
  if (!normalized) {
    return false;
  }
  if (TICKET_CTA_TEXT_PATTERN.test(normalized)) {
    return true;
  }
  const compact = normalized.replace(/\s+/g, '').toLowerCase();
  return /^(?:tickets)+$/i.test(compact) || /^ticketkaufen$/i.test(compact);
}

export interface OfficialTicketCtaObservation {
  ctaObserved: boolean;
  ctaText?: string;
  ctaVisible?: boolean;
  ctaDisabled?: boolean;
  rawHref?: string;
  dataHref?: string;
  dataUrl?: string;
  elementClass?: string;
  elementTag?: string;
  hasTicketSemantics: boolean;
}

export function isPublishedTicketTargetUrl(url: string): boolean {
  if (!url.startsWith('https://')) {
    return false;
  }
  if (isMerchandiseUrl(url) || isShopRootUrl(url) || isTicketIoShopRootUrl(url)) {
    return false;
  }
  if (
    isTicketIoEventDetailUrl(url) ||
    isPaylogicEventDetailUrl(url) ||
    isFourvenuesEventDetailUrl(url)
  ) {
    return true;
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (/eventim\./i.test(host)) {
      return true;
    }
    if (isTicketKingsHost(host)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function inferVisible(className: string, style?: string): boolean {
  if (/element_hidden|hidden|disabled/i.test(className)) {
    return false;
  }
  if (style && /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) {
    return false;
  }
  return true;
}

function inferDisabled(className: string, ariaDisabled?: string): boolean {
  if (/disabled|element_hidden/i.test(className)) {
    return true;
  }
  return ariaDisabled === 'true';
}

export function discoverOfficialTicketCtaFromHtml(html: string): OfficialTicketCtaObservation {
  const $ = cheerio.load(html);
  const candidates: OfficialTicketCtaObservation[] = [];

  $('a, button, [role="button"]').each((_index, element) => {
    const $el = $(element);
    const tag = element.tagName?.toLowerCase() ?? 'unknown';
    const className = $el.attr('class') ?? '';
    const text = normalizeCtaText($el.text());
    const ariaLabel = normalizeCtaText($el.attr('aria-label') ?? '');
    const combined = `${text} ${ariaLabel} ${className}`;
    const hasTicketSemantics =
      textHasTicketCtaSemantics(combined) ||
      (className.includes('button secondary fluid') && textHasTicketCtaSemantics(text));
    if (!hasTicketSemantics || (NON_TICKET_CTA_PATTERN.test(combined) && !textHasTicketCtaSemantics(text))) {
      return;
    }
    candidates.push({
      ctaObserved: true,
      ctaText: text || ariaLabel || undefined,
      ctaVisible: inferVisible(className, $el.attr('style')),
      ctaDisabled: inferDisabled(className, $el.attr('aria-disabled')),
      rawHref: $el.attr('href')?.trim(),
      dataHref: $el.attr('data-href')?.trim(),
      dataUrl: $el.attr('data-url')?.trim(),
      elementClass: className || undefined,
      elementTag: tag,
      hasTicketSemantics: true,
    });
  });

  if (candidates.length === 0) {
    return { ctaObserved: false, hasTicketSemantics: false };
  }

  const scored = candidates.sort((left, right) => {
    const leftScore =
      (left.elementClass?.includes('button secondary fluid') ? 100 : 0) +
      (left.hasTicketSemantics ? 50 : 0) +
      (left.ctaText && textHasTicketCtaSemantics(left.ctaText) ? 30 : 0);
    const rightScore =
      (right.elementClass?.includes('button secondary fluid') ? 100 : 0) +
      (right.hasTicketSemantics ? 50 : 0) +
      (right.ctaText && textHasTicketCtaSemantics(right.ctaText) ? 30 : 0);
    return rightScore - leftScore;
  });

  return scored[0]!;
}

export function pageHtmlContainsPublishedTicketTarget(html: string): boolean {
  const $ = cheerio.load(html);
  const attrs = ['href', 'data-href', 'data-url', 'data-link', 'action'];
  for (const attr of attrs) {
    const elements = $(`[${attr}]`);
    for (let index = 0; index < elements.length; index += 1) {
      const value = $(elements[index]).attr(attr)?.trim();
      if (isPublishedTicketTargetUrl(value ?? '')) {
        return true;
      }
    }
  }
  const scriptUrls = html.match(/https:\/\/[^\s"'<>]*(?:paylogic|ticket\.io|fourvenues)[^\s"'<>]*/gi) ?? [];
  return scriptUrls.some((url) => isPublishedTicketTargetUrl(url));
}

export function officialPageHasPublishedTicketTarget(html: string, discoveredUrls: string[]): boolean {
  if (discoveredUrls.some((url) => isPublishedTicketTargetUrl(url))) {
    return true;
  }
  return pageHtmlContainsPublishedTicketTarget(html);
}
