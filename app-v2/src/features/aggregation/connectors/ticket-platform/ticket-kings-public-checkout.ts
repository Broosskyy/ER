import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

import {
  aggregateAdmissionAvailability,
  classifyTicketKingsProduct,
  type TicketKingsProductClassification,
} from './ticket-kings-product-classification';

export interface TicketKingsPublicRelease {
  name: string;
  ticketType?: string;
  phaseName?: string;
  priceAmount?: number;
  priceCurrency?: string;
  priceText?: string;
  soldOut?: boolean;
  available?: boolean;
  remainingQuantity?: number;
  availabilityText?: string;
  purchaseUrl?: string;
}

export interface TicketKingsCheckoutProductRecord {
  rawProductName: string;
  rawPhaseName?: string;
  rawPriceText?: string;
  priceAmount?: number;
  priceCurrency?: string;
  availabilityText?: string;
  remainingQuantity?: number;
  optionalState: 'required' | 'optional' | 'unknown';
  sectionHeading?: string;
  classification: TicketKingsProductClassification;
  includedInEventSummary: boolean;
  exclusionReason?: string;
  structuralSignals: string[];
  soldOut?: boolean;
  available?: boolean;
}

export interface TicketKingsPublicCheckoutEvidence {
  checkoutUrl?: string;
  releases: TicketKingsPublicRelease[];
  products: TicketKingsCheckoutProductRecord[];
  excludedProducts: TicketKingsCheckoutProductRecord[];
  priceAmount?: number;
  maximumPrice?: number;
  priceCurrency?: string;
  priceText?: string;
  soldOut?: boolean;
  availability: 'available' | 'sold_out' | 'review_required';
  reviewRequired: boolean;
  evidenceSource: 'native_event_iframe' | 'html_cards' | 'json_ld';
}

const NATIVE_EVENT_IFRAME_PATTERN =
  /(?:src|href)=["'](https?:\/\/nacht-manager\.de\/ticketing\/native_event\.php\?id=\d+[^"']*)["']/i;

const HTML_CARD_PRICE_PATTERN =
  /(?:ticket|release|phase)[^<]{0,80}?([\d]+[.,]\d{2})\s*€/gi;

function parseGermanAmount(raw: string): number | undefined {
  const amount = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(amount) ? amount : undefined;
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseRemainingQuantity(text: string): number | undefined {
  const match = text.match(/noch\s+(\d+)\s+verfügbar/i);
  if (!match?.[1]) {
    return undefined;
  }
  const quantity = Number.parseInt(match[1], 10);
  return Number.isFinite(quantity) ? quantity : undefined;
}

function parseAvailabilityState(
  availabilityText: string | undefined,
  block: string,
): { soldOut?: boolean; available?: boolean } {
  const haystack = `${availabilityText ?? ''} ${stripTags(block)}`.toLowerCase();
  if (/ausverkauft|sold\s*out|nicht\s+verfügbar|nicht\s+mehr\s+verfügbar/.test(haystack)) {
    return { soldOut: true, available: false };
  }
  if (/noch\s+\d+\s+verfügbar|verfügbar|available/.test(haystack)) {
    return { soldOut: false, available: true };
  }
  return {};
}

function formatAbPrice(amount: number): string {
  return `ab ${amount.toFixed(2).replace('.', ',')} €`;
}

function buildReleaseName(ticketType: string, phaseName?: string): string {
  if (phaseName?.trim()) {
    return `${ticketType} — ${phaseName.trim()}`;
  }
  return ticketType;
}

function parseAdmissionOptionBlocks(html: string): TicketKingsCheckoutProductRecord[] {
  const products: TicketKingsCheckoutProductRecord[] = [];
  const sectionHeading = stripTags(
    html.match(/ticket-selection-card[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/i)?.[1] ?? 'Tickets',
  );

  const blocks =
    html.match(
      /<div class="box ticket-type-box ticket-option-choice">[\s\S]*?<\/div>\s*<\/div>\s*(?:\n\s*)?<\/div>/gi,
    ) ?? [];

  for (const block of blocks) {
    const ticketType = stripTags(block.match(/ticket-option-title[^>]*>([^<]+)</i)?.[1] ?? '');
    const metaHtml = block.match(/ticket-option-meta[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
    const metaSpans = [...metaHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((match) =>
      stripTags(match[1] ?? ''),
    );
    const phaseName = metaSpans.find((span) => !/EUR|€|verfügbar|ausverkauft|pro\s+ticket/i.test(span));
    const priceMatch =
      block.match(/<strong>\s*([\d.,]+)\s*EUR\s*<\/strong>/i) ??
      block.match(/([\d.,]+)\s*EUR/i);
    const priceAmount = priceMatch?.[1] ? parseGermanAmount(priceMatch[1]) : undefined;
    const availabilityText = metaSpans.find((span) => /verfügbar|ausverkauft/i.test(span));
    const availability = parseAvailabilityState(availabilityText, block);
    const classification = classifyTicketKingsProduct({
      structuralRole: 'admission_option',
      sectionHeading,
      productName: ticketType || 'Ticket',
      isQuantityStepper: /data-qty-stepper/i.test(block),
    });

    products.push({
      rawProductName: ticketType || 'Ticket',
      rawPhaseName: phaseName,
      rawPriceText: priceMatch?.[0] ? stripTags(priceMatch[0]) : undefined,
      priceAmount,
      priceCurrency: priceAmount !== undefined ? 'EUR' : undefined,
      availabilityText,
      remainingQuantity: availabilityText ? parseRemainingQuantity(availabilityText) : undefined,
      optionalState: 'required',
      sectionHeading,
      classification: classification.classification,
      includedInEventSummary: classification.includedInEventSummary,
      exclusionReason: classification.exclusionReason,
      structuralSignals: classification.structuralSignals,
      soldOut: availability.soldOut,
      available: availability.available,
    });
  }

  return products;
}

function parseAddonBlocks(html: string): TicketKingsCheckoutProductRecord[] {
  const products: TicketKingsCheckoutProductRecord[] = [];
  const sectionHeading = stripTags(
    html.match(/ticket-addons-card[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/i)?.[1] ?? 'Zusatzoptionen',
  );
  const blocks =
    html.match(
      /<div class="box ticket-type-box ticket-addon-choice">[\s\S]*?<\/div>\s*<\/div>\s*(?:\n\s*)?<\/div>/gi,
    ) ?? [];

  for (const block of blocks) {
    const productName =
      stripTags(block.match(/ticket-addon-title[^>]*>([^<]+)</i)?.[1] ?? '') ||
      stripTags(block.match(/class="ticket-addon-title"[^>]*>([^<]+)</i)?.[1] ?? '') ||
      'Add-on';
    const priceText = stripTags(block.match(/ticket-addon-price[^>]*>([\s\S]*?)<\/label>/i)?.[1] ?? '');
    const priceMatch = priceText.match(/([\d.,]+)\s*EUR/i);
    const priceAmount = priceMatch?.[1] ? parseGermanAmount(priceMatch[1]) : undefined;
    const classification = classifyTicketKingsProduct({
      structuralRole: 'addon_checkbox',
      sectionHeading,
      productName,
      isCheckbox: /type="checkbox"/i.test(block),
    });

    products.push({
      rawProductName: productName,
      rawPriceText: priceText || undefined,
      priceAmount,
      priceCurrency: priceAmount !== undefined ? 'EUR' : undefined,
      optionalState: 'optional',
      sectionHeading,
      classification: classification.classification,
      includedInEventSummary: classification.includedInEventSummary,
      exclusionReason: classification.exclusionReason,
      structuralSignals: classification.structuralSignals,
    });
  }

  return products;
}

function parseBuyerOptionalBlocks(html: string): TicketKingsCheckoutProductRecord[] {
  const products: TicketKingsCheckoutProductRecord[] = [];
  const sectionHeading = stripTags(
    html.match(/ticket-buyer-options[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/i)?.[1] ?? 'Optionen',
  );
  const blocks = html.match(/<div class="ticket-optional-item">[\s\S]*?<\/div>\s*<\/div>/gi) ?? [];

  for (const block of blocks) {
    const productName = stripTags(block.match(/ticket-option-copy[\s\S]*?<span[^>]*>([^<]+)</i)?.[1] ?? '');
    if (!productName) {
      continue;
    }
    const priceMatch = block.match(/([\d.,]+)\s*EUR/i);
    const priceAmount = priceMatch?.[1] ? parseGermanAmount(priceMatch[1]) : undefined;
    const classification = classifyTicketKingsProduct({
      structuralRole: 'buyer_optional',
      sectionHeading,
      productName,
      isCheckbox: /type="checkbox"/i.test(block),
    });

    products.push({
      rawProductName: productName,
      rawPriceText: priceMatch?.[0] ? stripTags(priceMatch[0]) : undefined,
      priceAmount,
      priceCurrency: priceAmount !== undefined ? 'EUR' : undefined,
      optionalState: 'optional',
      sectionHeading,
      classification: classification.classification,
      includedInEventSummary: classification.includedInEventSummary,
      exclusionReason: classification.exclusionReason,
      structuralSignals: classification.structuralSignals,
    });
  }

  return products;
}

function parseLegacyCardBlocks(html: string): TicketKingsCheckoutProductRecord[] {
  const products: TicketKingsCheckoutProductRecord[] = [];
  const seen = new Set<string>();

  for (const block of html.match(/<(?:div|tr|li)[^>]*class="[^"]*(?:ticket|release|product)[^"]*"[^>]*>[\s\S]*?<\/(?:div|tr|li)>/gi) ?? []) {
    if (/ticket-option-choice|ticket-addon-choice|ticket-optional-item/i.test(block)) {
      continue;
    }
    const className = block.match(/class="([^"]+)"/i)?.[1] ?? '';
    const name = stripTags(block.match(/>([^<]{2,80})</)?.[1] ?? '');
    const priceMatch = block.match(/([\d]+[.,]\d{2})\s*€/i);
    const priceAmount = priceMatch?.[1] ? parseGermanAmount(priceMatch[1]) : undefined;
    if (!name || priceAmount === undefined) {
      continue;
    }
    const key = `${name}|${priceAmount}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const availability = parseAvailabilityState(undefined, block);
    const classification = classifyTicketKingsProduct({
      structuralRole: 'legacy_card',
      productName: name,
      structuralClassName: className,
    });

    products.push({
      rawProductName: name,
      rawPriceText: priceMatch?.[0] ? stripTags(priceMatch[0]) : undefined,
      priceAmount,
      priceCurrency: 'EUR',
      optionalState: 'unknown',
      classification: classification.classification,
      includedInEventSummary: classification.includedInEventSummary,
      exclusionReason: classification.exclusionReason,
      structuralSignals: classification.structuralSignals,
      soldOut: availability.soldOut,
      available: availability.available,
    });
  }

  return products;
}

function admissionProductsToReleases(products: TicketKingsCheckoutProductRecord[]): TicketKingsPublicRelease[] {
  return products
    .filter((product) => product.classification === 'admission_ticket')
    .map((product) => ({
      name: buildReleaseName(product.rawProductName, product.rawPhaseName),
      ticketType: product.rawProductName,
      phaseName: product.rawPhaseName,
      priceAmount: product.priceAmount,
      priceCurrency: product.priceCurrency ?? 'EUR',
      priceText:
        product.priceAmount !== undefined ? formatAbPrice(product.priceAmount) : product.rawPriceText,
      soldOut: product.soldOut,
      available: product.available,
      remainingQuantity: product.remainingQuantity,
      availabilityText: product.availabilityText,
    }));
}

function deriveAdmissionPriceSummary(releases: TicketKingsPublicRelease[]): {
  priceAmount?: number;
  maximumPrice?: number;
  priceText?: string;
} {
  const purchasable = releases.filter(
    (release) =>
      release.priceAmount !== undefined &&
      release.soldOut !== true &&
      release.available !== false,
  );
  if (purchasable.length === 0) {
    const priced = releases
      .map((release) => release.priceAmount)
      .filter((amount): amount is number => amount !== undefined);
    if (priced.length === 0) {
      return {};
    }
    const min = Math.min(...priced);
    const max = Math.max(...priced);
    return {
      priceAmount: min,
      maximumPrice: max,
      priceText: formatAbPrice(min),
    };
  }

  const amounts = purchasable
    .map((release) => release.priceAmount)
    .filter((amount): amount is number => amount !== undefined);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return {
    priceAmount: min,
    maximumPrice: max,
    priceText: formatAbPrice(min),
  };
}

export function extractNativeEventCheckoutUrl(html: string): string | undefined {
  const match = html.match(NATIVE_EVENT_IFRAME_PATTERN);
  return match?.[1]?.replace(/&amp;/g, '&');
}

export function parseTicketKingsCheckoutHtml(html: string): TicketKingsPublicCheckoutEvidence {
  const structuredProducts = [
    ...parseAdmissionOptionBlocks(html),
    ...parseAddonBlocks(html),
    ...parseBuyerOptionalBlocks(html),
  ];

  const products =
    structuredProducts.length > 0 ? structuredProducts : parseLegacyCardBlocks(html);

  const admissionProducts = products.filter((product) => product.classification === 'admission_ticket');
  const excludedProducts = products.filter((product) => !product.includedInEventSummary);
  let releases = admissionProductsToReleases(products);

  if (releases.length === 0 && structuredProducts.length === 0) {
    let cardMatch: RegExpExecArray | null;
    const pattern = new RegExp(HTML_CARD_PRICE_PATTERN.source, 'gi');
    while ((cardMatch = pattern.exec(html)) !== null) {
      const priceAmount = cardMatch[1] ? parseGermanAmount(cardMatch[1]) : undefined;
      if (priceAmount === undefined) {
        continue;
      }
      const classification = classifyTicketKingsProduct({
        structuralRole: 'legacy_card',
        productName: 'Standard',
      });
      if (!classification.includedInEventSummary) {
        continue;
      }
      releases.push({
        name: 'Standard',
        ticketType: 'Standard',
        priceAmount,
        priceCurrency: 'EUR',
        priceText: formatAbPrice(priceAmount),
      });
    }
  }

  const priceSummary = deriveAdmissionPriceSummary(releases);
  const availability = aggregateAdmissionAvailability(products);
  const soldOut = availability === 'sold_out' ? true : undefined;
  const reviewRequired = availability === 'review_required' || admissionProducts.length === 0;

  return {
    releases,
    products,
    excludedProducts,
    priceAmount: priceSummary.priceAmount,
    maximumPrice: priceSummary.maximumPrice,
    priceCurrency: priceSummary.priceAmount !== undefined ? 'EUR' : undefined,
    priceText: priceSummary.priceText,
    soldOut,
    availability,
    reviewRequired,
    evidenceSource: structuredProducts.length > 0 ? 'native_event_iframe' : 'html_cards',
  };
}

export async function enrichTicketKingsDetailFromPublicCheckout(
  detailHtml: string,
  fetchHtml: (url: string) => Promise<string>,
): Promise<TicketKingsPublicCheckoutEvidence | undefined> {
  const checkoutUrl = extractNativeEventCheckoutUrl(detailHtml);
  if (!checkoutUrl) {
    return undefined;
  }
  try {
    const checkoutHtml = await fetchHtml(checkoutUrl);
    const evidence = parseTicketKingsCheckoutHtml(checkoutHtml);
    return { ...evidence, checkoutUrl };
  } catch {
    return undefined;
  }
}
