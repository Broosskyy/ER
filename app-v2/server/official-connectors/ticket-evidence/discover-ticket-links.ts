import * as cheerio from 'cheerio';

import type { DiscoveredTicketLink, TicketLinkRelation } from './types';
import {
  classifyTicketLinkCandidate,
  candidateToDiscoveredLink,
  extractTicketUrlsFromEmbeddedContent,
  selectPrimaryTicketCandidate,
  type TicketLinkCandidate,
} from './ticket-link-candidates';
import {
  isCheckoutOrSessionTicketUrl,
  isMerchandiseUrl,
  isShopRootUrl,
  isTicketIoEventDetailUrl,
} from './url-policy';

const TICKET_CTA_TEXT_PATTERN =
  /\b(?:tickets?|ticket\s*kaufen|jetzt\s+kaufen|buy\s+tickets?|vorverkauf|get\s+tickets?|eintritt)\b/i;
const PRESALE_PATTERN = /\b(?:presale|vorverkauf|pre-?sale)\b/i;
const BOX_OFFICE_PATTERN = /\b(?:abendkasse|box\s*office)\b/i;
const NON_TICKET_HREF_PATTERN =
  /\b(?:tablebooking|bootshaus-app|facebook\.com|instagram\.com|youtube\.com|itunes\.apple\.com|mailto:|cdn-cgi|l\.facebook\.com)\b/i;

interface RawCandidate {
  url: string;
  source: string;
  tag: string;
  text: string;
  className: string;
  score: number;
  relation: TicketLinkRelation;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https:\/\//i.test(value.trim());
}

function extractUrlFromOnclick(onclick: string): string | undefined {
  const patterns = [
    /window\.open\(\s*['"]([^'"]+)['"]/i,
    /location\.href\s*=\s*['"]([^'"]+)['"]/i,
    /window\.location\s*=\s*['"]([^'"]+)['"]/i,
    /['"](https?:\/\/[^'"]+)['"]/i,
  ];
  for (const pattern of patterns) {
    const match = onclick.match(pattern);
    if (match?.[1] && isAbsoluteHttpUrl(match[1])) {
      return match[1];
    }
  }
  return undefined;
}

function inferRelation(text: string, className: string, href: string): TicketLinkRelation {
  const combined = `${text} ${className} ${href}`;
  if (PRESALE_PATTERN.test(combined)) {
    return 'presale';
  }
  if (BOX_OFFICE_PATTERN.test(combined)) {
    return 'box_office';
  }
  if (/\.ticket\.io\b|paylogic\.com|fourvenues\.com|eventim\.|rausgegangen\./i.test(href)) {
    return 'ticket_provider';
  }
  if (TICKET_CTA_TEXT_PATTERN.test(combined)) {
    return 'official_ticket';
  }
  return 'unknown';
}

function scoreCandidate(candidate: RawCandidate): number {
  let score = candidate.score;
  if (candidate.className.includes('button secondary fluid') || TICKET_CTA_TEXT_PATTERN.test(candidate.text)) {
    score += 120;
  }
  if (candidate.className.includes('button') && TICKET_CTA_TEXT_PATTERN.test(candidate.text)) {
    score += 80;
  }
  if (candidate.relation === 'official_ticket' || candidate.relation === 'ticket_provider') {
    score += 50;
  }
  if (candidate.relation === 'presale') {
    score += 30;
  }
  if (NON_TICKET_HREF_PATTERN.test(candidate.url)) {
    score -= 200;
  }
  if (isMerchandiseUrl(candidate.url)) {
    score -= 500;
  }
  if (isShopRootUrl(candidate.url) || isCheckoutOrSessionTicketUrl(candidate.url)) {
    score -= 500;
  }
  if (/\.ticket\.io\/?$/i.test(candidate.url) || /bootshaus\.ticket\.io$/i.test(candidate.url)) {
    score -= 400;
  }
  if (/\.ticket\.io\b/i.test(candidate.url) && !isTicketIoEventDetailUrl(candidate.url)) {
    score -= 300;
  }
  if (candidate.className.includes('element_hidden')) {
    score -= 10;
  }
  if (!candidate.url) {
    score -= 500;
  }
  return score;
}

function collectFromElement(
  element: unknown,
  $: cheerio.CheerioAPI,
  pageUrl: string,
  observedAt: string,
): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const el = element as { tagName?: string };
  const tag = el.tagName ? String(el.tagName).toLowerCase() : 'unknown';
  const $el = $(element as Parameters<typeof $>[0]);
  const className = $el.attr('class') ?? '';
  const text = $el.text().replace(/\s+/g, ' ').trim();

  const hrefCandidates: Array<{ url: string; source: string }> = [];
  const href = $el.attr('href')?.trim();
  if (href && isAbsoluteHttpUrl(href)) {
    hrefCandidates.push({ url: href, source: `${tag}[href]` });
  }
  const dataHref = $el.attr('data-href')?.trim();
  if (dataHref && isAbsoluteHttpUrl(dataHref)) {
    hrefCandidates.push({ url: dataHref, source: `${tag}[data-href]` });
  }
  const dataUrl = $el.attr('data-url')?.trim();
  if (dataUrl && isAbsoluteHttpUrl(dataUrl)) {
    hrefCandidates.push({ url: dataUrl, source: `${tag}[data-url]` });
  }
  const dataLink = $el.attr('data-link')?.trim();
  if (dataLink && isAbsoluteHttpUrl(dataLink)) {
    hrefCandidates.push({ url: dataLink, source: `${tag}[data-link]` });
  }
  const onclick = $el.attr('onclick')?.trim();
  if (onclick) {
    const onclickUrl = extractUrlFromOnclick(onclick);
    if (onclickUrl) {
      hrefCandidates.push({ url: onclickUrl, source: `${tag}[onclick]` });
    }
  }

  for (const entry of hrefCandidates) {
    const relation = inferRelation(text, className, entry.url);
    candidates.push({
      url: entry.url,
      source: entry.source,
      tag,
      text,
      className,
      score: 0,
      relation,
    });
  }

  return candidates;
}

function collectJsonLdOfferUrls(html: string): Array<{ url: string; source: string }> {
  const results: Array<{ url: string; source: string }> = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const offers = parsed.offers;
      if (offers && typeof offers === 'object' && !Array.isArray(offers)) {
        const url = String((offers as Record<string, unknown>).url ?? '').trim();
        if (isAbsoluteHttpUrl(url)) {
          results.push({ url, source: 'json-ld[offers.url]' });
        }
      }
      if (Array.isArray(offers)) {
        for (const offer of offers) {
          if (offer && typeof offer === 'object') {
            const url = String((offer as Record<string, unknown>).url ?? '').trim();
            if (isAbsoluteHttpUrl(url)) {
              results.push({ url, source: 'json-ld[offers[].url]' });
            }
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return results;
}

export function discoverTicketLinkCandidates(
  html: string,
  pageUrl: string,
): TicketLinkCandidate[] {
  const $ = cheerio.load(html);
  const candidates: TicketLinkCandidate[] = [];
  const seen = new Set<string>();

  $('a[href^="https://"], [data-href^="https://"], [data-url^="https://"]').each((_index, element) => {
    const $el = $(element);
    const href =
      $el.attr('href')?.trim() ??
      $el.attr('data-href')?.trim() ??
      $el.attr('data-url')?.trim() ??
      '';
    if (!href || seen.has(href)) {
      return;
    }
    seen.add(href);
    candidates.push(
      classifyTicketLinkCandidate({
        rawUrl: href,
        elementKind: element.tagName?.toLowerCase() ?? 'a',
        visibleText: $el.text().replace(/\s+/g, ' ').trim(),
        classNames: [$el.attr('class') ?? ''],
      }),
    );
  });

  for (const embeddedUrl of extractTicketUrlsFromEmbeddedContent(html)) {
    if (seen.has(embeddedUrl)) {
      continue;
    }
    seen.add(embeddedUrl);
    candidates.push(
      classifyTicketLinkCandidate({
        rawUrl: embeddedUrl,
        elementKind: 'embedded-script',
      }),
    );
  }

  return candidates;
}

export function discoverRejectedTicketCandidates(html: string, pageUrl: string): Array<{ url: string; reason: string }> {
  return discoverTicketLinkCandidates(html, pageUrl)
    .filter((candidate) => candidate.rejectionReason)
    .map((candidate) => ({ url: candidate.rawUrl, reason: candidate.rejectionReason ?? 'rejected' }));
}

export function discoverTicketLinksFromHtml(
  html: string,
  pageUrl: string,
  observedAt: string,
): DiscoveredTicketLink[] {
  const $ = cheerio.load(html);
  const rawCandidates: RawCandidate[] = [];

  $('a[href], button, [data-href], [data-url], [data-link], [onclick]').each((_index, element) => {
    rawCandidates.push(...collectFromElement(element, $, pageUrl, observedAt));
  });

  $('.event-description-content a[href], .event-description a[href]').each((_index, element) => {
    rawCandidates.push(...collectFromElement(element, $, pageUrl, observedAt));
  });

  $('iframe[src]').each((_index, element) => {
    const src = $(element).attr('src')?.trim();
    if (src && isAbsoluteHttpUrl(src)) {
      rawCandidates.push({
        url: src,
        source: 'iframe[src]',
        tag: 'iframe',
        text: '',
        className: '',
        score: 20,
        relation: 'ticket_provider',
      });
    }
  });

  for (const entry of collectJsonLdOfferUrls(html)) {
    rawCandidates.push({
      url: entry.url,
      source: entry.source,
      tag: 'script',
      text: '',
      className: '',
      score: 60,
      relation: inferRelation('', '', entry.url),
    });
  }

  for (const embeddedUrl of extractTicketUrlsFromEmbeddedContent(html)) {
    rawCandidates.push({
      url: embeddedUrl,
      source: 'embedded-script',
      tag: 'script',
      text: '',
      className: '',
      score: 70,
      relation: inferRelation('', '', embeddedUrl),
    });
  }

  const scored = rawCandidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate) }))
    .filter((candidate) => candidate.score > 0 && candidate.url);

  const byUrl = new Map<string, DiscoveredTicketLink>();
  for (const candidate of scored) {
    const normalizedUrl = candidate.url.trim();
    const existing = byUrl.get(normalizedUrl);
    const link: DiscoveredTicketLink = {
      rawUrl: normalizedUrl,
      relation: candidate.relation,
      discoveredOnUrl: pageUrl,
      discoveredFromSource: candidate.source,
      observedAt,
      elementTag: candidate.tag,
      elementText: candidate.text || undefined,
      elementClass: candidate.className || undefined,
    };
    if (!existing || candidate.score > (scored.find((c) => c.url === normalizedUrl)?.score ?? 0)) {
      byUrl.set(normalizedUrl, link);
    }
  }

  return [...byUrl.values()].sort((left, right) => {
    const leftScore = scored.find((c) => c.url === left.rawUrl)?.score ?? 0;
    const rightScore = scored.find((c) => c.url === right.rawUrl)?.score ?? 0;
    return rightScore - leftScore;
  });
}

export function selectPrimaryTicketLink(links: DiscoveredTicketLink[]): DiscoveredTicketLink | undefined {
  const candidates = links.map((link) =>
    classifyTicketLinkCandidate({
      rawUrl: link.rawUrl,
      elementKind: link.elementTag ?? 'a',
      visibleText: link.elementText,
      classNames: link.elementClass ? [link.elementClass] : undefined,
    }),
  );
  const primaryCandidate = selectPrimaryTicketCandidate(candidates);
  if (!primaryCandidate) {
    return undefined;
  }
  const match = links.find((link) => link.rawUrl === primaryCandidate.rawUrl);
  return match ?? candidateToDiscoveredLink(primaryCandidate, links[0]?.discoveredOnUrl ?? '', 'candidate', new Date().toISOString());
}
