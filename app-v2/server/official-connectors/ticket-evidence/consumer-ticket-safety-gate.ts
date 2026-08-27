import type {
  TicketActionKind,
  TicketIdentityResult,
  TicketPriceEvidenceState,
  TicketSourceState,
  TicketTargetIdentityDecision,
} from './types';
import { isShopRootUrl } from './url-policy';

export interface ConsumerTicketSafetyInput {
  ticketSourceState?: TicketSourceState;
  identityResult?: TicketIdentityResult;
  identityDecision?: TicketTargetIdentityDecision;
  salesStatus?: string | null;
  actionKind?: TicketActionKind | string;
  actionLabel?: string;
  canonicalTicketUrl?: string;
  priceEvidenceState?: TicketPriceEvidenceState | string;
}

const BLOCKED_SOURCE_STATES = new Set<TicketSourceState>([
  'historical_ticket_detail',
  'provider_access_unavailable',
  'ticket_link_not_yet_published',
  'waitlist',
]);

const BLOCKED_IDENTITY_RESULTS = new Set<TicketIdentityResult>([
  'ticket_identity_conflict',
  'ticket_identity_stale_official_link',
  'ticket_identity_unverifiable',
]);

const BLOCKED_IDENTITY_DECISIONS = new Set<TicketTargetIdentityDecision>([
  'redirected_to_different_event',
  'stale_ticket_detail',
  'identity_unverifiable',
]);

const BLOCKED_SALES_STATUSES = new Set([
  'availability_unverified',
  'sales_ended',
  'sale_not_started',
  'sold_out',
  'cancelled',
]);

export function hasVerifiedPurchaseTarget(input: ConsumerTicketSafetyInput): boolean {
  if (!input.canonicalTicketUrl?.startsWith('https://')) {
    return false;
  }
  if (isShopRootUrl(input.canonicalTicketUrl)) {
    return false;
  }
  if (input.ticketSourceState && BLOCKED_SOURCE_STATES.has(input.ticketSourceState)) {
    return false;
  }
  if (input.ticketSourceState && input.ticketSourceState !== 'current_ticket_detail') {
    return false;
  }
  if (input.identityResult && BLOCKED_IDENTITY_RESULTS.has(input.identityResult)) {
    return false;
  }
  if (input.identityDecision && BLOCKED_IDENTITY_DECISIONS.has(input.identityDecision)) {
    return false;
  }
  if (input.salesStatus && BLOCKED_SALES_STATUSES.has(input.salesStatus)) {
    return false;
  }
  if (input.actionKind === 'presale_registration' || input.actionKind === 'waitlist' || input.actionKind === 'historical_ticket_detail') {
    return false;
  }
  return true;
}

export function hasActivePurchaseCta(input: ConsumerTicketSafetyInput): boolean {
  return hasVerifiedPurchaseTarget(input);
}

export function hasVerifiedPresaleCta(input: ConsumerTicketSafetyInput): boolean {
  if (!input.canonicalTicketUrl?.startsWith('https://')) {
    return false;
  }
  if (input.ticketSourceState !== 'presale_registration') {
    return false;
  }
  if (input.identityResult && BLOCKED_IDENTITY_RESULTS.has(input.identityResult)) {
    return false;
  }
  if (input.identityDecision && BLOCKED_IDENTITY_DECISIONS.has(input.identityDecision)) {
    return false;
  }
  return input.actionKind === 'presale_registration' || input.actionKind === 'waitlist';
}

export function consumerTicketUrl(input: ConsumerTicketSafetyInput): string | undefined {
  if (hasActivePurchaseCta(input) || hasVerifiedPresaleCta(input)) {
    return input.canonicalTicketUrl;
  }
  return undefined;
}
