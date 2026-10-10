import { describe, expect, it } from 'vitest';

import {
  normalizeRausgegangenTicketAvailability,
  resolveRausgegangenTicketAction,
} from '../ticket-availability';

describe('Rausgegangen ticket availability', () => {
  it('maps schema.org availability values without inventing availability', () => {
    expect(normalizeRausgegangenTicketAvailability('https://schema.org/InStock')).toBe('AVAILABLE');
    expect(normalizeRausgegangenTicketAvailability('https://schema.org/LimitedAvailability')).toBe('LOW_AVAILABILITY');
    expect(normalizeRausgegangenTicketAvailability('https://schema.org/SoldOut')).toBe('SOLD_OUT');
    expect(normalizeRausgegangenTicketAvailability('https://schema.org/OutOfStock')).toBe('SOLD_OUT');
    expect(normalizeRausgegangenTicketAvailability('https://schema.org/PreOrder')).toBe('NOT_YET_ON_SALE');
    expect(normalizeRausgegangenTicketAvailability('something-unknown')).toBe('UNKNOWN');
  });

  it('keeps the ticket URL usable when availability is unknown but blocks known non-purchasable states', () => {
    const url = 'https://tickets.example/event/123';
    expect(resolveRausgegangenTicketAction(url, 'AVAILABLE')).toBe('PURCHASE');
    expect(resolveRausgegangenTicketAction(url, 'LOW_AVAILABILITY')).toBe('PURCHASE');
    expect(resolveRausgegangenTicketAction(url, 'UNKNOWN')).toBe('PURCHASE');
    expect(resolveRausgegangenTicketAction(url, 'SOLD_OUT')).toBe('NONE');
    expect(resolveRausgegangenTicketAction(url, 'NOT_YET_ON_SALE')).toBe('NONE');
  });
});
