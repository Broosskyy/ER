import type { TicketIoProbeResult } from '@/features/ticket-platform-discovery/discovery/ticket-io-probe';

export const TICKET_IO_SHOP_QUALIFICATION_TIERS = ['relevant', 'uncertain', 'irrelevant'] as const;
export type TicketIoShopQualificationTier = (typeof TICKET_IO_SHOP_QUALIFICATION_TIERS)[number];

export interface TicketIoShopQualification {
  tier: TicketIoShopQualificationTier;
  acceptanceRate: number;
  recommendedPublishBehavior: 'auto_publish' | 'manual_review';
  recommendedReviewRequired: boolean;
  reasons: string[];
}

const RELEVANT_MIN_EVENTS = 3;
const RELEVANT_MIN_ACCEPTANCE_RATE = 0.5;
const UNCERTAIN_MIN_EVENTS = 1;

export function qualifyTicketIoShop(probe: TicketIoProbeResult): TicketIoShopQualification {
  const reasons: string[] = [];
  const discovered = probe.scopeStats.discovered;
  const accepted = probe.scopeStats.accepted;
  const uncertain = probe.scopeStats.uncertain ?? 0;
  const rejected = probe.scopeStats.rejected;
  const acceptanceRate = discovered > 0 ? accepted / discovered : 0;
  const importableCount = accepted + uncertain;

  if (!probe.valid || importableCount === 0) {
    return {
      tier: 'irrelevant',
      acceptanceRate,
      recommendedPublishBehavior: 'manual_review',
      recommendedReviewRequired: true,
      reasons: ['No importable electronic events discovered.'],
    };
  }

  if (
    accepted >= RELEVANT_MIN_EVENTS &&
    acceptanceRate >= RELEVANT_MIN_ACCEPTANCE_RATE &&
    probe.requiredFieldsValid
  ) {
    reasons.push(`${accepted} relevant electronic events with ${Math.round(acceptanceRate * 100)}% acceptance.`);
    return {
      tier: 'relevant',
      acceptanceRate,
      recommendedPublishBehavior: 'auto_publish',
      recommendedReviewRequired: false,
      reasons,
    };
  }

  if (importableCount >= UNCERTAIN_MIN_EVENTS) {
    reasons.push(
      `Shop has ${importableCount} importable events but below auto-activation threshold (${RELEVANT_MIN_EVENTS} relevant @ ${RELEVANT_MIN_ACCEPTANCE_RATE * 100}%).`,
    );
    if (uncertain > 0) {
      reasons.push(`${uncertain} uncertain events will route to review.`);
    }
    if (rejected > 0) {
      reasons.push(`${rejected} events classified irrelevant.`);
    }
    return {
      tier: 'uncertain',
      acceptanceRate,
      recommendedPublishBehavior: 'manual_review',
      recommendedReviewRequired: true,
      reasons,
    };
  }

  return {
    tier: 'irrelevant',
    acceptanceRate,
    recommendedPublishBehavior: 'manual_review',
    recommendedReviewRequired: true,
    reasons: ['Insufficient electronic music signal for activation.'],
  };
}
