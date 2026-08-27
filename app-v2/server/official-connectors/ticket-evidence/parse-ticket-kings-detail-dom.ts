import { createHash } from 'node:crypto';

import * as cheerio from 'cheerio';

import { classifyTicketOffer, isAdmissionOfferRole } from './ticket-offer-role';
import { isTicketMarketingOrCtaLine } from '../shared/lineup-normalization';
import { normalizeTicketPriceLine } from './normalize-ticket-price';
import type { TicketOfferRole, VerifiedTicketStatus } from './types';
import { isTicketProviderBlockedBody } from './safe-fetch-ticket';

export interface TicketKingsDetailDomOffer {
  rawLabel: string;
  phaseLabel?: string;
  role: TicketOfferRole;
  rawPrice?: string;
  amountMinor?: number;
  currency?: string;
  purchasable: boolean;
  soldOut: boolean;
}

export interface TicketKingsDetailDomEvidence {
  providerEventId?: string;
  eventTitle?: string;
  startAt?: string;
  endAt?: string;
  venueName?: string;
  descriptionClean?: string;
  lineupCandidates: Array<{ displayName: string; rawText: string }>;
  ticketStatus: VerifiedTicketStatus;
  offers: TicketKingsDetailDomOffer[];
  rejectedOffers: Array<{ rawLabel: string; reason: string }>;
  embeddedTicketingUrls: string[];
  contentFingerprint: string;
}

const SOLD_OUT_PATTERN = /\b(?:sold\s*out|ausverkauft)\b/i;
const TICKETING_EMBED_HOST_PATTERN = /n8manager\.de|nightmanager|ticketing\/native_event/i;
const DESCRIPTION_BOILERPLATE_PATTERN =
  /ticketkings\.de|warenkorb|checkout|google calendar|ical export|sichert euch euer ticket|seid schnell/i;

function fingerprintBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

function extractJsonLdEvent(body: string): Record<string, unknown> | undefined {
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    try {
      const parsed = JSON.parse(match[1] ?? '') as Record<string, unknown> | Array<Record<string, unknown>>;
      const event = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!event) {
        continue;
      }
      const type = String(event['@type'] ?? '');
      if (type.includes('Event') || type.includes('MusicEvent')) {
        return event;
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8222;/g, '"');
}

export function cleanTicketKingsDescriptionHtml(html: string): string | undefined {
  const $ = cheerio.load(`<div>${html}</div>`);
  $('script, style, iframe, noscript').remove();
  $('a[href*="ticketkings"]').remove();
  const text = decodeHtmlEntities($('div').text().replace(/\s+/g, ' ').trim());
  if (!text || text.length < 40) {
    return undefined;
  }
  if (DESCRIPTION_BOILERPLATE_PATTERN.test(text) && text.length < 120) {
    return undefined;
  }
  return text;
}

function extractDescriptionFromDom(body: string): string | undefined {
  const $ = cheerio.load(body);
  const tribe = $('.tribe-events-single-event-description, .tribe-events-content').first();
  if (tribe.length > 0) {
    return cleanTicketKingsDescriptionHtml(tribe.html() ?? '');
  }
  const meta = $('meta[name="description"]').attr('content')?.trim();
  if (meta && meta.length >= 40) {
    return decodeHtmlEntities(meta);
  }
  return undefined;
}

function extractEmbeddedTicketingUrls(body: string): string[] {
  const urls: string[] = [];
  const iframePattern = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = iframePattern.exec(body)) !== null) {
    const url = match[1]?.trim();
    if (url && TICKETING_EMBED_HOST_PATTERN.test(url)) {
      try {
        urls.push(new URL(url, 'https://ticketkings.de').toString());
      } catch {
        // ignore
      }
    }
  }
  return [...new Set(urls)];
}

function parseNmPhaseInfo(body: string): Record<
  string,
  { name: string; price_minor: number; currency: string }
> {
  const match = body.match(/var\s+NM_PHASE_INFO\s*=\s*(\{[\s\S]*?\});/);
  if (!match?.[1]) {
    return {};
  }
  try {
    return JSON.parse(match[1]) as Record<string, { name: string; price_minor: number; currency: string }>;
  } catch {
    return {};
  }
}

function parseOffersFromEmbedDom(body: string): TicketKingsDetailDomOffer[] {
  const offers: TicketKingsDetailDomOffer[] = [];
  const phaseInfo = parseNmPhaseInfo(body);
  const $ = cheerio.load(body);

  $('.ticket-option-choice, .ticket-type-box').each((_index, element) => {
    const title = $(element).find('.ticket-option-title, .ticket-type-label').first().text().replace(/\s+/g, ' ').trim();
    if (!title) {
      return;
    }
    const phase = $(element).find('.ticket-option-meta span').first().text().replace(/\s+/g, ' ').trim();
    const labelForClassification = phase ? `${title} ${phase}` : title;
    const classification = classifyTicketOffer({ label: labelForClassification });
    const priceText =
      $(element).find('.ticket-option-all-in-price strong, .ticket-option-all-in-price').first().text().replace(/\s+/g, ' ').trim();
    const soldOut =
      SOLD_OUT_PATTERN.test($(element).text()) ||
      $(element).attr('data-available') === 'false' ||
      $(element).find('[disabled]').length > 0;
    let amountMinor: number | undefined;
    let currency = 'EUR';
    let rawPrice = priceText;

    if (priceText) {
      const normalized = normalizeTicketPriceLine(priceText);
      amountMinor = normalized.amountMinor;
      rawPrice = normalized.rawPrice ?? priceText;
    }

    const tid = $(element).find('[data-tid]').attr('data-tid');
    if (tid && phaseInfo[tid]) {
      const info = phaseInfo[tid];
      amountMinor = info.price_minor;
      currency = info.currency ?? 'EUR';
      if (!rawPrice && amountMinor != null) {
        rawPrice = `${(amountMinor / 100).toFixed(2).replace('.', ',')} ${currency}`;
      }
    }

    if (amountMinor === 0) {
      return;
    }

    offers.push({
      rawLabel: title,
      phaseLabel: phase || undefined,
      role: classification.role,
      rawPrice,
      amountMinor,
      currency,
      purchasable: !soldOut,
      soldOut,
    });
  });

  if (offers.length === 0 && Object.keys(phaseInfo).length > 0) {
    for (const [tid, info] of Object.entries(phaseInfo)) {
      if (!info.price_minor || info.price_minor <= 0) {
        continue;
      }
      const classification = classifyTicketOffer({ label: info.name });
      offers.push({
        rawLabel: info.name,
        role: classification.role,
        rawPrice: `${(info.price_minor / 100).toFixed(2).replace('.', ',')} ${info.currency ?? 'EUR'}`,
        amountMinor: info.price_minor,
        currency: info.currency ?? 'EUR',
        purchasable: true,
        soldOut: false,
      });
      void tid;
    }
  }

  return offers;
}

function splitCapsBillingRow(row: string): string[] {
  const words = row.replace(/\s+/g, ' ').trim().split(/\s+/);
  const acts: string[] = [];
  let index = 0;
  while (index < words.length) {
    const current = words[index] ?? '';
    const next = words[index + 1] ?? '';
    const nextNext = words[index + 2] ?? '';
    if (
      index > 0 &&
      next &&
      nextNext &&
      current.length >= 4 &&
      next.length >= 4 &&
      nextNext.length <= 3 &&
      looksLikeCapsBillingName(current) &&
      looksLikeCapsBillingName(next) &&
      looksLikeCapsBillingName(nextNext)
    ) {
      acts.push(current);
      acts.push(`${next} ${nextNext}`);
      index += 3;
      continue;
    }
    if (
      next &&
      looksLikeCapsBillingName(current) &&
      looksLikeCapsBillingName(next) &&
      (current.length <= 3 || (current.length > 2 && next.length > 2))
    ) {
      acts.push(`${current} ${next}`);
      index += 2;
      continue;
    }
    acts.push(current);
    index += 1;
  }
  return acts.filter((name) => name.length >= 2 && name.length <= 60 && looksLikeCapsBillingName(name));
}

function looksLikeCapsBillingName(name: string): boolean {
  const words = name.split(/\s+/);
  return words.every((word) => /^[A-ZÀ-ÖØ-Þ0-9Ø][A-ZÀ-ÖØ-Þ0-9Ø&/.-]*$/.test(word));
}

export function extractLineupFromTicketKingsDescription(
  description?: string,
): Array<{ displayName: string; rawText: string }> {
  if (!description) {
    return [];
  }
  const lineupSection = description.match(
    /line[- ]?up\s*:?\s*([A-ZÀ-ÖØ-Þ0-9Ø][\s\S]+?)(?:\s*📅|\bweitere informationen\b|\bsichert euch\b|\bwarenkorb\b|$)/i,
  );
  if (!lineupSection?.[1]) {
    return [];
  }
  const candidates: Array<{ displayName: string; rawText: string }> = [];
  const body = lineupSection[1].split(/📅/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  const lines = body.split(/[\n,•|]/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const line of lines.length > 0 ? lines : [body]) {
    const segments =
      /^[A-ZÀ-ÖØ-Þ0-9Ø][A-ZÀ-ÖØ-Þ0-9Ø\sØøÆæÅåÄÖÜäöü&/.-]+$/.test(line) && line.split(/\s+/).length >= 4
        ? splitCapsBillingRow(line)
        : [line];
    for (const name of segments) {
      if (!name || name.length < 2 || name.length > 60) {
        continue;
      }
      if (/^\d+[,.]?\d*\s*(?:EUR|€)?$/i.test(name)) {
        continue;
      }
      if (isTicketMarketingOrCtaLine(name)) {
        continue;
      }
      if (!looksLikeCapsBillingName(name)) {
        continue;
      }
      if (/^(?:dj|live|floor|main|upper|lower)\b/i.test(name) && name.split(/\s+/).length <= 2) {
        continue;
      }
      if (/^sichert euch/i.test(name)) {
        continue;
      }
      candidates.push({ displayName: name, rawText: name });
    }
  }
  return candidates;
}

function resolveTicketStatus(offers: TicketKingsDetailDomOffer[]): VerifiedTicketStatus {
  const admission = offers.filter((offer) => isAdmissionOfferRole(offer.role));
  if (admission.some((offer) => offer.purchasable && !offer.soldOut)) {
    return 'available';
  }
  if (admission.length > 0 && admission.every((offer) => offer.soldOut)) {
    return 'sold_out';
  }
  return 'unavailable_unknown';
}

export function parseTicketKingsDetailDom(body: string, canonicalUrl: string): TicketKingsDetailDomEvidence {
  const jsonLd = extractJsonLdEvent(body);
  const location = jsonLd?.location as Record<string, unknown> | undefined;
  const descriptionClean = extractDescriptionFromDom(body);
  const embeddedTicketingUrls = extractEmbeddedTicketingUrls(body);
  let offers = parseOffersFromEmbedDom(body);
  const rejectedOffers = offers
    .filter((offer) => !isAdmissionOfferRole(offer.role))
    .map((offer) => ({ rawLabel: offer.rawLabel, reason: 'non_admission_offer' }));

  offers = offers.filter((offer) => isAdmissionOfferRole(offer.role));

  const segments = new URL(canonicalUrl).pathname.split('/').filter(Boolean);
  const providerEventId = segments[segments.length - 1] || segments[0];

  return {
    providerEventId,
    eventTitle: jsonLd ? String(jsonLd.name ?? '').trim() : undefined,
    startAt: jsonLd ? String(jsonLd.startDate ?? '').trim() : undefined,
    endAt: jsonLd ? String(jsonLd.endDate ?? '').trim() : undefined,
    venueName: location ? String(location.name ?? '').trim() : undefined,
    descriptionClean,
    lineupCandidates: extractLineupFromTicketKingsDescription(descriptionClean),
    ticketStatus: resolveTicketStatus(offers),
    offers,
    rejectedOffers,
    embeddedTicketingUrls,
    contentFingerprint: fingerprintBody(body),
  };
}

export async function enrichTicketKingsDomWithEmbeds(
  domEvidence: TicketKingsDetailDomEvidence,
  fetchEmbed: (url: string) => Promise<{ body: string; blocked: boolean }>,
): Promise<TicketKingsDetailDomEvidence> {
  if (domEvidence.offers.length > 0) {
    return domEvidence;
  }

  for (const embedUrl of domEvidence.embeddedTicketingUrls) {
    const fetched = await fetchEmbed(embedUrl);
    if (fetched.blocked || !fetched.body || isTicketProviderBlockedBody(fetched.body, 'text/html')) {
      continue;
    }
    const embedOffers = parseOffersFromEmbedDom(fetched.body);
    if (embedOffers.length === 0) {
      continue;
    }
    const embedDescription = cleanTicketKingsDescriptionHtml(
      cheerio.load(fetched.body)('.nm-event-description, .event-description').html() ?? fetched.body,
    );
    return {
      ...domEvidence,
      descriptionClean: domEvidence.descriptionClean ?? embedDescription,
      lineupCandidates:
        domEvidence.lineupCandidates.length > 0
          ? domEvidence.lineupCandidates
          : extractLineupFromTicketKingsDescription(embedDescription ?? domEvidence.descriptionClean),
      offers: embedOffers.filter((offer) => isAdmissionOfferRole(offer.role)),
      rejectedOffers: [
        ...domEvidence.rejectedOffers,
        ...embedOffers
          .filter((offer) => !isAdmissionOfferRole(offer.role))
          .map((offer) => ({ rawLabel: offer.rawLabel, reason: 'non_admission_offer' })),
      ],
      ticketStatus: resolveTicketStatus(embedOffers),
      contentFingerprint: createHash('sha256')
        .update(domEvidence.contentFingerprint + fingerprintBody(fetched.body))
        .digest('hex'),
    };
  }

  return domEvidence;
}
