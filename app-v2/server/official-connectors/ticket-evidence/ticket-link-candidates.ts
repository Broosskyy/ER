import type { DiscoveredTicketLink, TicketLinkRelation } from './types';
import {
  isCheckoutOrSessionTicketUrl,
  isMerchandiseUrl,
  isShopRootUrl,
  isTicketIoEventDetailUrl,
} from './url-policy';

const TICKET_CTA_TEXT_PATTERN =
  /\b(?:tickets?|ticket\s*kaufen|jetzt\s+kaufen|buy\s+tickets?|vorverkauf|get\s+tickets?)\b/i;
const PRESALE_PATTERN = /\b(?:presale|vorverkauf|pre-?sale)\b/i;
const MERCH_TEXT_PATTERN = /\b(?:merch|merchandise|merch-shop|kollektionen)\b/i;
const SOCIAL_PATTERN =
  /\b(?:facebook|instagram|youtube|tiktok|twitter|soundcloud|spotify|play\.google)\b/i;

export interface TicketLinkCandidate {
  rawUrl: string;
  resolvedUrl?: string;
  elementKind: string;
  visibleText?: string;
  ariaLabel?: string;
  title?: string;
  classNames?: string[];
  relation: TicketLinkRelation;
  providerHint?: string;
  rejectionReason?: string;
  confidence: number;
}

export function inferProviderHint(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('ticket.io')) return 'ticket_io';
    if (host.includes('paylogic.com')) return 'paylogic';
    if (host.includes('fourvenues.com')) return 'fourvenues';
    if (host.includes('ticketkings')) return 'ticket_kings';
    if (host.includes('eventim.')) return 'eventim';
    if (host.includes('vault-events.de')) return 'organizer_shop';
    if (host.includes('arep.co')) return 'organizer_shop';
    if (host.includes('bit.ly')) return 'redirector';
    return undefined;
  } catch {
    return undefined;
  }
}

function inferRelation(text: string, className: string, href: string): TicketLinkRelation {
  const combined = `${text} ${className} ${href}`;
  if (PRESALE_PATTERN.test(combined)) return 'presale';
  if (/\.ticket\.io\b|paylogic\.com|fourvenues\.com|eventim\.|ticketkings/i.test(href)) {
    return 'ticket_provider';
  }
  if (TICKET_CTA_TEXT_PATTERN.test(combined)) return 'official_ticket';
  return 'unknown';
}

export function classifyTicketLinkCandidate(input: {
  rawUrl: string;
  elementKind: string;
  visibleText?: string;
  ariaLabel?: string;
  title?: string;
  classNames?: string[];
}): TicketLinkCandidate {
  const text = `${input.visibleText ?? ''} ${input.ariaLabel ?? ''} ${input.title ?? ''}`;
  const className = (input.classNames ?? []).join(' ');
  const url = input.rawUrl.trim();

  let confidence = 0;
  let rejectionReason: string | undefined;

  if (!url.startsWith('https://')) {
    rejectionReason = 'non_https_url';
    confidence = -500;
  } else if (isMerchandiseUrl(url) || MERCH_TEXT_PATTERN.test(text) && !TICKET_CTA_TEXT_PATTERN.test(text)) {
    rejectionReason = 'merchandise_link_rejected';
    confidence = -500;
  } else if (SOCIAL_PATTERN.test(url) || SOCIAL_PATTERN.test(text)) {
    rejectionReason = 'social_link_rejected';
    confidence = -400;
  } else if (isShopRootUrl(url) || isCheckoutOrSessionTicketUrl(url)) {
    rejectionReason = isShopRootUrl(url) ? 'shop_root' : 'checkout_url';
    confidence = -500;
  } else if (/\.ticket\.io\b/i.test(url) && !isTicketIoEventDetailUrl(url)) {
    rejectionReason = 'ticket_io_non_detail';
    confidence = -300;
  } else {
    if (className.includes('button secondary fluid') || TICKET_CTA_TEXT_PATTERN.test(text)) {
      confidence += 120;
    }
    if (/paylogic\.com|fourvenues\.com|\.ticket\.io\b/i.test(url)) {
      confidence += 80;
    }
    if (inferRelation(text, className, url) === 'ticket_provider') {
      confidence += 50;
    }
  }

  const relation = inferRelation(text, className, url);
  return {
    rawUrl: url,
    elementKind: input.elementKind,
    visibleText: input.visibleText,
    ariaLabel: input.ariaLabel,
    title: input.title,
    classNames: input.classNames,
    relation,
    providerHint: inferProviderHint(url),
    rejectionReason,
    confidence,
  };
}

export function candidateToDiscoveredLink(
  candidate: TicketLinkCandidate,
  pageUrl: string,
  discoveredFromSource: string,
  observedAt: string,
): DiscoveredTicketLink {
  return {
    rawUrl: candidate.rawUrl,
    relation: candidate.relation,
    discoveredOnUrl: pageUrl,
    discoveredFromSource,
    observedAt,
    elementTag: candidate.elementKind,
    elementText: candidate.visibleText,
    elementClass: candidate.classNames?.join(' ') || undefined,
  };
}

export function selectPrimaryTicketCandidate(candidates: TicketLinkCandidate[]): TicketLinkCandidate | undefined {
  const eligible = candidates.filter((c) => !c.rejectionReason && c.confidence > 0);
  if (eligible.length === 0) {
    return undefined;
  }
  eligible.sort((a, b) => b.confidence - a.confidence);
  return eligible[0];
}

export function extractTicketUrlsFromEmbeddedContent(html: string): string[] {
  const patterns = [
    /https:\/\/shop\.paylogic\.com\/[a-f0-9]{32}/gi,
    /https:\/\/[a-z0-9-]+\.ticket\.io\/[A-Za-z0-9]{6,12}\/?/gi,
    /https:\/\/site\.fourvenues\.com\/[^"'\\s<>]+/gi,
    /https:\/\/www\.vault-events\.de\/termine\/[^"'\\s<>]+/gi,
  ];
  const urls: string[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      if (match[0]) {
        urls.push(match[0].replace(/&amp;/g, '&'));
      }
    }
  }
  return [...new Set(urls)];
}
