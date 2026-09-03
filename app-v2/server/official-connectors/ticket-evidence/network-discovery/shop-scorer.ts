import { mediaQualityScore } from './media-classifier';
import type { TicketIoEventDiscoveryCandidate, TicketIoShopCandidate, TicketIoShopValueScore } from './types';

/** Shops with large mixed inventories must not auto-promote on raw event count alone. */
const MIXED_INVENTORY_SHOP_SLUGS = new Set(['stadtgarten']);

const MIN_TIER_1_ELECTRONIC_RATIO = 0.65;
const MIN_TIER_1_TICKET_EVIDENCE = 0.4;
const MIN_TIER_1_DATA_COMPLETENESS = 0.5;

function isRelevant(relevance: string): boolean {
  return relevance === 'HIGH_RELEVANCE' || relevance === 'LIKELY_RELEVANT';
}

function ticketEvidenceScore(candidate: TicketIoEventDiscoveryCandidate): number {
  let score = 0;
  if (candidate.ticketUrl) score += 1;
  if (candidate.listAmountMinor != null) score += 1;
  if (candidate.listTicketStatus) score += 1;
  if (candidate.visibleProducts.length > 1) score += 1;
  if (candidate.visibleProducts.some((p) => p.admissionClass)) score += 1;
  return score;
}

export function scoreTicketIoShops(
  shops: TicketIoShopCandidate[],
  events: TicketIoEventDiscoveryCandidate[],
): TicketIoShopValueScore[] {
  return shops.map((shop) => {
    const shopEvents = events.filter((event) => event.shopSlug === shop.slug);
    const upcoming = shopEvents.filter((event) => event.lifecycle !== 'ENDED');
    const relevant = upcoming.filter((event) => isRelevant(event.relevance));
    const netNew = relevant.filter((event) => event.matchClassification === 'NET_NEW');
    const high = relevant.filter((event) => event.relevance === 'HIGH_RELEVANCE').length;
    const likely = relevant.filter((event) => event.relevance === 'LIKELY_RELEVANT').length;

    const ticketScores = relevant.map(ticketEvidenceScore);
    const mediaScores = relevant.map((event) => mediaQualityScore(event.mediaRoles));
    const ticketEvidenceCompleteness =
      ticketScores.length === 0 ? 0 : ticketScores.reduce((sum, value) => sum + value, 0) / (ticketScores.length * 5);
    const mediaQuality =
      mediaScores.length === 0 ? 0 : mediaScores.reduce((sum, value) => sum + value, 0) / (mediaScores.length * 5);

    const electronicRelevanceRatio = upcoming.length === 0 ? 0 : relevant.length / upcoming.length;
    const dataCompleteness =
      relevant.length === 0
        ? 0
        : relevant.filter((event) => event.startsAt && event.venueName && event.listAmountMinor != null).length /
          relevant.length;

    let tier: TicketIoShopValueScore['tier'] = 'REJECT';
    const tierReasons: string[] = [];

    if (shop.status === 'UNREACHABLE' || shop.status === 'REJECTED') {
      tier = 'REJECT';
      tierReasons.push(`shop_status:${shop.status}`);
    } else if (
      high + likely >= 3 &&
      netNew.length >= 1 &&
      ticketEvidenceCompleteness >= MIN_TIER_1_TICKET_EVIDENCE &&
      electronicRelevanceRatio >= MIN_TIER_1_ELECTRONIC_RATIO &&
      dataCompleteness >= MIN_TIER_1_DATA_COMPLETENESS
    ) {
      tier = 'TIER_1_ENABLE_FIRST';
      tierReasons.push(
        'strong_electronic_signal',
        'net_new_inventory',
        'usable_ticket_evidence',
        'high_electronic_ratio',
      );
    } else if (relevant.length >= 2 || (high + likely >= 1 && electronicRelevanceRatio >= 0.25)) {
      tier = 'TIER_2_ENABLE_LATER';
      tierReasons.push('moderate_electronic_coverage');
    } else if (relevant.length > 0) {
      tier = 'SUPPLEMENTAL_ONLY';
      tierReasons.push('low_net_new_but_useful_for_ticket_evidence');
    } else {
      tier = 'REJECT';
      tierReasons.push('no_relevant_upcoming_events');
    }

    if (shop.slug === 'bootshaus-club') {
      tier = 'TIER_1_ENABLE_FIRST';
      tierReasons.push('verified_existing_canonical_overlap');
    }

    if (MIXED_INVENTORY_SHOP_SLUGS.has(shop.slug) && tier === 'TIER_1_ENABLE_FIRST') {
      tier = 'TIER_2_ENABLE_LATER';
      tierReasons.push('mixed_inventory_shop_cap');
    }

    return {
      shopId: shop.shopId,
      slug: shop.slug,
      canonicalUrl: shop.canonicalUrl,
      upcomingEventCount: upcoming.length,
      highRelevanceCount: high,
      likelyRelevantCount: likely,
      netNewRelevantCount: netNew.length,
      electronicRelevanceRatio,
      ticketEvidenceCompleteness,
      mediaQualityScore: mediaQuality,
      tier,
      tierReasons: [...new Set(tierReasons)],
    };
  });
}
