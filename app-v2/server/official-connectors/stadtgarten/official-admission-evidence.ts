import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';

export interface StadtgartenAdmissionQuote {
  priceMinor: number;
  currency: 'EUR';
  kind: 'presale' | 'box_office';
  rawPrice: string;
}

/**
 * Extract the ticket prices *printed on the specific official event page*.
 * Never use a site-wide header or shop root to infer a price.
 */
export function readStadtgartenOfficialAdmission(html: string): StadtgartenAdmissionQuote | undefined {
  const $ = cheerio.load(html);
  const text = $('.asidetext').text().replace(/\s+/g, ' ').trim();
  if (!text || /\b(?:ausverkauft|sold out|abgesagt|cancelled)\b/i.test(text)) return undefined;

  const quotes: StadtgartenAdmissionQuote[] = [];
  for (const match of text.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*€\s*(vorverkauf|abendkasse)\b/gi)) {
    const number = Number(match[1]!.replace(',', '.'));
    if (!Number.isFinite(number) || number < 0 || number > 500) continue;
    const priceMinor = Math.round(number * 100);
    const kind = /^vorverkauf$/i.test(match[2]!) ? 'presale' : 'box_office';
    quotes.push({ priceMinor, currency: 'EUR', kind, rawPrice: match[0]!.trim() });
  }
  // Prefer the explicitly quoted presale price. Door-only events remain
  // source-priced, with NO fabricated checkout link or online availability.
  return quotes.find(quote => quote.kind === 'presale') ??
    quotes.find(quote => quote.kind === 'box_office');
}

export function addStadtgartenSourcePriceFallback(
  result: VerifiedTicketCompleteResult,
  officialHtml: string,
  observedAt: string,
): VerifiedTicketCompleteResult {
  const quote = readStadtgartenOfficialAdmission(officialHtml);
  if (!quote ||
      result.verifiedTicketComplete ||
      result.ticketEvidence ||
      result.canonicalTicketUrl ||
      result.primaryLink ||
      result.identityResult === 'ticket_identity_conflict') return result;

  let origin: URL;
  try { origin = new URL(result.officialUrl); } catch { return result; }
  if (origin.protocol !== 'https:' ||
      !['www.stadtgarten.de', 'stadtgarten.de'].includes(origin.hostname) ||
      !/^\/programm\/[a-z0-9-]+-\d+\/?$/i.test(origin.pathname)) return result;

  const reason = quote.kind === 'box_office'
    ? 'official_door_admission_without_purchase_target'
    : 'official_presale_price_without_verified_purchase_target';
  const contentFingerprint = createHash('sha256').update(officialHtml).digest('hex');
  return {
    ...result,
    providerKey: 'organizer_shop',
    classification: 'ticket_link_not_yet_published',
    resolutionClass: 'ticket_link_not_yet_published',
    verifiedTicketComplete: false,
    priceEvidence: {
      state: 'verified_current',
      amountMinor: quote.priceMinor,
      currency: 'EUR',
      rawPriceText: quote.rawPrice,
      sourceUrl: result.officialUrl,
      sourceObservedAt: observedAt,
      contentFingerprint,
      evidenceOrigin: 'verified_live_capture',
      reason,
    },
    ticketSourceStateEvidence: {
      state: 'ticket_link_not_yet_published',
      sourceEventUrl: result.officialUrl,
      observedAt,
      contentFingerprint,
      ctaObserved: false,
      ctaVisible: false,
      evidenceOrigin: 'official_source_dom',
      reason,
    },
    statusProjection: {
      availabilityStatus: 'availability_unverified',
      normalizedStatus: 'availability_unverified',
      statusLabel: 'Verfügbarkeit nicht bestätigt',
      statusEvidenceOrigin: 'official_source_dom',
    },
    consumerPreview: {
      title: result.title,
      startsAt: result.startsAt,
      venueName: result.venueName,
      providerKey: 'organizer_shop',
      visiblePrice: quote.rawPrice,
      priceFromMinor: quote.priceMinor,
      currency: 'EUR',
      status: 'availability_unverified',
      canonicalTicketUrl: undefined,
      admissionOfferCount: 1,
      rejectedAddonCount: 0,
      evidenceOrigin: 'official_source_dom',
      identityResult: result.identityResult,
      priceLabel: quote.rawPrice,
      priceEvidenceState: 'verified_current',
      actionKind: quote.kind === 'box_office' ? 'box_office' : 'ticket_detail',
      actionLabel: quote.kind === 'box_office' ? 'Nur Abendkasse' : 'Ticketshop nicht verifiziert',
      evidenceObservedAt: observedAt,
      statusEvidenceOrigin: 'official_source_dom',
    },
  };
}
