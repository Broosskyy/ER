import type {
  TicketActionState,
  TicketAvailabilityState,
} from '../ticket-evidence/network-discovery/detail-types';

function normalizedToken(raw?: string): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:www\.)?schema\.org\//, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizeRausgegangenTicketAvailability(
  raw?: string,
): TicketAvailabilityState {
  const token = normalizedToken(raw);
  if (!token) {
    return 'UNKNOWN';
  }
  if (token.includes('limitedavailability') || token === 'limited') {
    return 'LOW_AVAILABILITY';
  }
  if (
    token.includes('soldout') ||
    token.includes('outofstock') ||
    token.includes('discontinued')
  ) {
    return 'SOLD_OUT';
  }
  if (
    token.includes('preorder') ||
    token.includes('presale') ||
    token.includes('notyetonsale') ||
    token.includes('salenotstarted')
  ) {
    return 'NOT_YET_ON_SALE';
  }
  if (
    token.includes('instock') ||
    token === 'available' ||
    token.includes('onlineonly')
  ) {
    return 'AVAILABLE';
  }
  return 'UNKNOWN';
}

export function resolveRausgegangenTicketAction(
  ticketUrl: string | undefined,
  availability: TicketAvailabilityState,
): TicketActionState {
  if (!ticketUrl?.startsWith('https://')) {
    return 'NONE';
  }
  if (availability === 'SOLD_OUT' || availability === 'NOT_YET_ON_SALE') {
    return 'NONE';
  }
  return 'PURCHASE';
}
