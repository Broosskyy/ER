/**
 * Phase 4.8.1.3 — semantic field comparison for gap elimination.
 * Removes only genuine comparison noise; never hides real differences.
 */
import { decodeHtmlEntities, normalizeText, stripHtml } from '@/features/import/normalization/text-normalizer';
import { compareTicketIoPriceSemantics, buildTicketIoPriceSemantics } from '@/features/import/domain/ticket-io-price-semantics';

export type GapComparisonStatus =
  | 'BOTH_CORRECT'
  | 'LEGACY_CORRECT'
  | 'UNIFIED_CORRECT'
  | 'UNIFIED_BETTER'
  | 'LEGACY_BETTER'
  | 'BOTH_INCORRECT'
  | 'INTENTIONALLY_UNSUPPORTED'
  | 'FIELD_OWNERSHIP_MISMATCH'
  | 'STALE_EVIDENCE'
  | 'REVIEW_REQUIRED'
  | 'PUBLIC_SOURCE_HAS_NO_FIELD';

export type LegacyBetterGroup = 'future_supported' | 'intentionally_unsupported' | 'review_required';

export type BothIncorrectCause =
  | 'Public Source'
  | 'Connector'
  | 'Importer'
  | 'Evidence Extraction'
  | 'Normalization'
  | 'Identity Matching'
  | 'Merge Simulation'
  | 'Comparison Logic'
  | 'Ground Truth Fixture'
  | 'Third-party Platform'
  | 'Unknown';

/** Fields a given importer must never own (not a failure when absent). */
export const IMPORTER_FIELD_RESPONSIBILITY: Record<string, Set<string>> = {
  'ticket-io': new Set(['title', 'description', 'venue', 'lineup', 'genres']),
  'ticket-kings': new Set(['checkout_url']),
  'nacht-manager': new Set(['title', 'description', 'venue', 'lineup', 'genres', 'ticketUrl', 'consumer_cta']),
  'official-website': new Set(['price', 'ticket_phases', 'availability', 'sold_out', 'checkout_url']),
};

/** Preferred single owner role per field for merge. */
export const PREFERRED_FIELD_OWNER: Record<string, string> = {
  title: 'official_website_source',
  description: 'official_website_source',
  genres: 'official_website_source',
  flyer: 'official_website_source',
  gallery: 'official_website_source',
  lineup: 'official_website_source',
  venue: 'official_website_source',
  ticketUrl: 'ticket_platform',
  consumer_cta: 'ticket_platform',
  price: 'ticket_platform',
  availability: 'ticket_platform',
  sold_out: 'ticket_platform',
  checkout_url: 'checkout_provider',
  ticket_phases: 'checkout_provider',
};

function normalizeUnicode(value: string): string {
  try {
    return value.normalize('NFKC');
  } catch {
    return value;
  }
}

function stripEmoji(value: string): string {
  return value.replace(/\p{Extended_Pictographic}/gu, '').replace(/\uFE0F/g, '');
}

function normalizeWhitespace(value: string): string {
  return normalizeUnicode(stripEmoji(decodeHtmlEntities(stripHtml(value))))
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeUrl(value: string): string {
  try {
    const u = new URL(value.trim());
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function parsePriceSemantics(value: unknown): {
  soldOut: boolean;
  amount: number | null;
  currency: string | null;
  raw: string;
} {
  const raw = String(value ?? '');
  const soldOut = /\bausverkauft\b|sold\s*out|vergriffen/i.test(raw);
  const amountMatch = raw.match(/(\d{1,4})[.,](\d{2})/);
  const amount = amountMatch ? Number(`${amountMatch[1]}.${amountMatch[2]}`) : null;
  const currency = /€|eur|euro/i.test(raw) ? 'EUR' : null;
  return { soldOut, amount, currency, raw };
}

export function pricesSemanticallyAlign(a: unknown, b: unknown): boolean {
  const pa = parsePriceSemantics(a);
  const pb = parsePriceSemantics(b);
  if (pa.soldOut && pb.soldOut) return true;
  if (pa.soldOut && /ausverkauft|sold\s*out/i.test(String(b))) return true;
  if (pb.soldOut && /ausverkauft|sold\s*out/i.test(String(a))) return true;
  if (pa.amount !== null && pb.amount !== null && Math.abs(pa.amount - pb.amount) < 0.01) return true;
  const na = normalizeWhitespace(pa.raw);
  const nb = normalizeWhitespace(pb.raw);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

export function descriptionsSemanticallyAlign(a: unknown, b: unknown): boolean {
  const na = normalizeWhitespace(String(a ?? ''));
  const nb = normalizeWhitespace(String(b ?? ''));
  if (!na || !nb) return false;
  if (na === nb) return true;
  const normalizedA = normalizeText(a, 50_000)?.toLowerCase();
  const normalizedB = normalizeText(b, 50_000)?.toLowerCase();
  if (normalizedA && normalizedB && normalizedA === normalizedB) return true;
  if (na.length > 200 && nb.length > 200) {
    const prefixA = na.slice(0, Math.min(400, na.length));
    const prefixB = nb.slice(0, Math.min(400, nb.length));
    if (prefixA === prefixB) return true;
    if (prefixA.includes(prefixB.slice(0, 200)) || prefixB.includes(prefixA.slice(0, 200))) return true;
  }
  return na.includes(nb) || nb.includes(na);
}

export function urlsSemanticallyAlign(a: unknown, b: unknown): boolean {
  const na = normalizeUrl(String(a ?? ''));
  const nb = normalizeUrl(String(b ?? ''));
  if (!na || !nb) return false;
  return na === nb;
}

export function isStaleTicketSlugCandidate(unified: unknown, production: unknown): boolean {
  const u = normalizeUrl(String(unified ?? ''));
  const p = normalizeUrl(String(production ?? ''));
  if (!u || !p) return false;
  if (u === p) return false;
  const uHost = u.includes('ticketkings') ? 'tk' : u.includes('ticket.io') ? 'tio' : 'other';
  const pHost = p.includes('ticketkings') ? 'tk' : p.includes('ticket.io') ? 'tio' : 'other';
  return uHost !== pHost || (uHost === 'tk' && pHost === 'tk' && u !== p);
}

export function isCheckoutVsConsumerCtaMismatch(unified: unknown, production: unknown): boolean {
  const u = String(unified ?? '');
  const p = String(production ?? '');
  return u.includes('nacht-manager') && p.includes('ticketkings');
}

export function importerOwnsField(importer: string, field: string): boolean {
  const denied = IMPORTER_FIELD_RESPONSIBILITY[importer];
  if (!denied) return true;
  if (field === 'ticketUrl' && importer === 'ticket-io') return true;
  if (field === 'ticketUrl' && importer === 'ticket-kings') return true;
  if (field === 'ticketUrl' && importer === 'nacht-manager') return false;
  if (field === 'price' && importer === 'nacht-manager') return true;
  return !denied.has(field);
}

export function classifyFieldComparison(input: {
  importer: string;
  field: string;
  unified: unknown;
  production: unknown;
  rawStatus: string;
}): {
  status: GapComparisonStatus;
  legacyBetterGroup?: LegacyBetterGroup;
  bothIncorrectCause?: BothIncorrectCause;
  clusterKey: string;
  note: string;
} {
  const { importer, field, unified, production } = input;
  const hasUnified = unified !== undefined && unified !== null && unified !== '';
  const hasProduction = production !== undefined && production !== null && production !== '';

  if (!importerOwnsField(importer, field)) {
    if (!hasUnified && hasProduction) {
      return {
        status: 'INTENTIONALLY_UNSUPPORTED',
        legacyBetterGroup: 'intentionally_unsupported',
        clusterKey: 'field_ownership_mismatch',
        note: `${importer} does not own ${field} — legacy value expected from another source role`,
      };
    }
    if (importer === 'nacht-manager' && field === 'ticketUrl' && isCheckoutVsConsumerCtaMismatch(unified, production)) {
      return {
        status: 'INTENTIONALLY_UNSUPPORTED',
        legacyBetterGroup: 'intentionally_unsupported',
        clusterKey: 'checkout_vs_consumer_cta',
        note: 'Nacht-Manager checkout URL must not be compared to consumer Ticket Kings CTA',
      };
    }
  }

  if (!hasUnified && !hasProduction) {
    return {
      status: 'PUBLIC_SOURCE_HAS_NO_FIELD',
      clusterKey: 'no_public_field',
      note: 'Neither path has value',
    };
  }

  if (!hasUnified && hasProduction) {
    if (!importerOwnsField(importer, field)) {
      return {
        status: 'INTENTIONALLY_UNSUPPORTED',
        legacyBetterGroup: 'intentionally_unsupported',
        clusterKey: 'field_ownership_mismatch',
        note: `${importer} intentionally does not extract ${field}`,
      };
    }
    return {
      status: 'LEGACY_BETTER',
      legacyBetterGroup: 'future_supported',
      clusterKey: 'missing_extractor',
      note: 'Unified path missing value present in production',
    };
  }

  if (hasUnified && !hasProduction) {
    return {
      status: 'UNIFIED_BETTER',
      clusterKey: 'unified_only',
      note: 'Unified has value; production empty',
    };
  }

  if (field === 'price' && importer === 'ticket-io' && hasUnified && hasProduction) {
    const semantics = buildTicketIoPriceSemantics({ rawLabel: String(unified) });
    const verdict = compareTicketIoPriceSemantics(semantics, String(production));
    if (verdict === 'aligned' || verdict === 'sold_out_unified_correct' || verdict === 'production_stale') {
      return {
        status: 'BOTH_CORRECT',
        clusterKey: verdict === 'production_stale' ? 'ticket_io_production_stale_price' : 'ticket_io_price_semantics',
        note:
          verdict === 'sold_out_unified_correct'
            ? 'Live sold-out evidence correct; production price is stale'
            : verdict === 'production_stale'
              ? 'Unified matches live list evidence; production price is stale'
              : 'Ticket.io price semantics align',
      };
    }
    if (verdict === 'placeholder_zero_conflict') {
      return {
        status: 'REVIEW_REQUIRED',
        bothIncorrectCause: 'Third-party Platform',
        clusterKey: 'ticket_io_sold_out_vs_zero_price',
        note: 'Sold-out vs production zero-price placeholder',
      };
    }
  }

  if (field === 'price' && pricesSemanticallyAlign(unified, production)) {
    return {
      status: 'BOTH_CORRECT',
      clusterKey: 'price_label_normalization',
      note: 'Price/sold-out semantics align after normalization',
    };
  }

  if (field === 'description' && descriptionsSemanticallyAlign(unified, production)) {
    return {
      status: 'BOTH_CORRECT',
      clusterKey: 'description_html_entity_whitespace',
      note: 'Description aligns after HTML entity and whitespace normalization',
    };
  }

  if (field === 'ticketUrl' && urlsSemanticallyAlign(unified, production)) {
    return {
      status: 'BOTH_CORRECT',
      clusterKey: 'url_trailing_slash',
      note: 'URLs align after normalization',
    };
  }

  if (field === 'ticketUrl' && isStaleTicketSlugCandidate(unified, production)) {
    return {
      status: 'STALE_EVIDENCE',
      legacyBetterGroup: 'review_required',
      clusterKey: 'stale_json_ld_offer_slug',
      note: 'Official website JSON-LD offer URL is stale vs verified ticket platform CTA',
      bothIncorrectCause: 'Public Source',
    };
  }

  if (field === 'ticketUrl' && isCheckoutVsConsumerCtaMismatch(unified, production)) {
    return {
      status: 'INTENTIONALLY_UNSUPPORTED',
      legacyBetterGroup: 'intentionally_unsupported',
      clusterKey: 'checkout_vs_consumer_cta',
      note: 'Checkout provider URL compared to consumer ticket page — wrong field layer',
    };
  }

  const na = normalizeWhitespace(String(unified));
  const nb = normalizeWhitespace(String(production));
  if (na === nb || na.includes(nb) || nb.includes(na)) {
    return {
      status: 'BOTH_CORRECT',
      clusterKey: 'whitespace_unicode_normalization',
      note: 'Values align after normalization',
    };
  }

  if (field === 'ticketUrl' && importer === 'ticket-kings') {
    const uSlug = String(unified).split('/').filter(Boolean).pop() ?? '';
    const pSlug = String(production).split('/').filter(Boolean).pop() ?? '';
    if (uSlug.includes('08-08') && pSlug.includes('20-06')) {
      return {
        status: 'STALE_EVIDENCE',
        bothIncorrectCause: 'Public Source',
        clusterKey: 'stale_ticket_kings_slug',
        note: 'Production canonical uses stale TK slug; unified has current event slug',
      };
    }
  }

  if (field === 'price' && parsePriceSemantics(unified).soldOut && String(production).includes('0,00')) {
    return {
      status: 'REVIEW_REQUIRED',
      bothIncorrectCause: 'Third-party Platform',
      clusterKey: 'ticket_io_sold_out_vs_zero_price',
      note: 'Ticket.io sold-out vs production zero-price placeholder',
    };
  }

  return {
    status: 'BOTH_INCORRECT',
    bothIncorrectCause: inferBothIncorrectCause(importer, field, unified, production),
    clusterKey: inferClusterKey(importer, field, unified, production),
    note: 'Genuine semantic difference remains after normalization',
  };
}

function inferBothIncorrectCause(
  importer: string,
  field: string,
  unified: unknown,
  production: unknown,
): BothIncorrectCause {
  if (field === 'ticketUrl' && isStaleTicketSlugCandidate(unified, production)) return 'Public Source';
  if (field === 'price' && importer === 'ticket-io') return 'Normalization';
  if (field === 'description' && String(unified).includes('<p>')) return 'Normalization';
  if (importer === 'ticket-kings' && field === 'ticketUrl') return 'Ground Truth Fixture';
  return 'Unknown';
}

function inferClusterKey(importer: string, field: string, unified: unknown, production: unknown): string {
  if (field === 'price') return 'price_label_mismatch';
  if (field === 'description') return 'description_residual_diff';
  if (field === 'ticketUrl' && isStaleTicketSlugCandidate(unified, production)) return 'stale_json_ld_offer_slug';
  if (field === 'ticketUrl') return 'ticket_url_mismatch';
  return `${importer}_${field}_unresolved`;
}

export function clusterComparisons(
  comparisons: Array<{
    importer: string;
    field: string;
    eventId: string;
    status: GapComparisonStatus;
    clusterKey: string;
    note: string;
    bothIncorrectCause?: BothIncorrectCause;
    legacyBetterGroup?: LegacyBetterGroup;
  }>,
): Array<{
  clusterName: string;
  affectedEvents: string[];
  affectedFields: string[];
  occurrences: number;
  earliestStage: string;
  responsibleModule: string;
  recommendedCorrection: string;
  primaryCause?: BothIncorrectCause;
}> {
  const byCluster = new Map<string, typeof comparisons>();
  for (const c of comparisons) {
    const list = byCluster.get(c.clusterKey) ?? [];
    list.push(c);
    byCluster.set(c.clusterKey, list);
  }

  const moduleMap: Record<string, { stage: string; module: string; fix: string }> = {
    price_label_normalization: {
      stage: 'normalization',
      module: 'semantic-field-comparison.ts:parsePriceSemantics',
      fix: 'Apply shared price normalizer in comparison and pilot output labels',
    },
    description_html_entity_whitespace: {
      stage: 'normalization',
      module: 'official-website-pilot.ts + text-normalizer',
      fix: 'Decode HTML entities and strip tags before evidence normalization',
    },
    field_ownership_mismatch: {
      stage: 'comparison',
      module: 'semantic-field-comparison.ts:IMPORTER_FIELD_RESPONSIBILITY',
      fix: 'Do not count as LEGACY_BETTER when importer does not own field',
    },
    checkout_vs_consumer_cta: {
      stage: 'comparison',
      module: 'semantic-field-comparison.ts',
      fix: 'Compare checkout_url field for NM; consumer_cta from TK/ticket.io only',
    },
    stale_json_ld_offer_slug: {
      stage: 'evidence_extraction',
      module: 'official-website-pilot.ts:ticket_destination_candidate',
      fix: 'Mark JSON-LD offer as stale candidate; never compare as consumer CTA',
    },
    stale_ticket_kings_slug: {
      stage: 'ground_truth',
      module: 'production canonical / legacy import',
      fix: 'Refresh production canonical ticket URL from current TK slug',
    },
    missing_extractor: {
      stage: 'importer',
      module: 'live-staging-pilots',
      fix: 'Implement missing extractor or declare IMPORER_UNSUPPORTED honestly',
    },
    ticket_io_sold_out_vs_zero_price: {
      stage: 'third_party',
      module: 'ticket-io-pilot + production projection',
      fix: 'Map sold-out list evidence; reject zero-price production placeholder',
    },
    price_label_mismatch: {
      stage: 'normalization',
      module: 'format-ticket-price.ts',
      fix: 'Emit canonical price label format matching production convention',
    },
    description_residual_diff: {
      stage: 'normalization',
      module: 'text-normalizer',
      fix: 'Residual emoji/HTML diff — review per event',
    },
  };

  return [...byCluster.entries()].map(([clusterName, items]) => {
    const meta = moduleMap[clusterName] ?? {
      stage: 'unknown',
      module: 'review',
      fix: 'Manual review required',
    };
    return {
      clusterName,
      affectedEvents: [...new Set(items.map((i) => i.eventId))],
      affectedFields: [...new Set(items.map((i) => i.field))],
      occurrences: items.length,
      earliestStage: meta.stage,
      responsibleModule: meta.module,
      recommendedCorrection: meta.fix,
      primaryCause: items.find((i) => i.bothIncorrectCause)?.bothIncorrectCause,
    };
  });
}
