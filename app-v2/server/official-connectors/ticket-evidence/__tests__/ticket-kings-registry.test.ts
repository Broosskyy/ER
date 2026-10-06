import { describe, expect, it } from 'vitest';

import { defaultTicketProviderRegistry } from '../provider-registry';
import { TicketKingsEvidenceProvider } from '../ticket-kings-evidence-provider';

const TICKET_KINGS_URL = 'https://tickets.ticketkings.com/events/bootshaus-test';

describe('Ticket Kings provider registry contract', () => {
  it('resolves ticket kings urls to TicketKingsEvidenceProvider', () => {
    const provider = defaultTicketProviderRegistry.resolveProvider(new URL(TICKET_KINGS_URL));
    expect(provider).not.toBeNull();
    expect(provider?.providerKey).toBe('ticket_kings');
    expect(provider).toBeInstanceOf(TicketKingsEvidenceProvider);
  });

  it('does not route ticket kings urls through organizer_shop', () => {
    const provider = defaultTicketProviderRegistry.resolveProvider(new URL(TICKET_KINGS_URL));
    expect(provider?.providerKey).not.toBe('organizer_shop');
  });

  it('canonicalizes and extracts provider identity', () => {
    const provider = new TicketKingsEvidenceProvider();
    const url = new URL(TICKET_KINGS_URL);
    const canonical = provider.canonicalizeUrl(url);
    expect(canonical?.canonicalUrl).toBe(TICKET_KINGS_URL);
    expect(canonical?.isEventDetailUrl).toBe(true);
    const identity = provider.extractProviderIdentity(url);
    expect(identity?.providerKey).toBe('ticket_kings');
    expect(identity?.providerScope).toBe('tickets.ticketkings.com');
    expect(identity?.providerEventId).toBe('bootshaus-test');
    expect(identity?.identityKey).toBe('ticket_kings:tickets.ticketkings.com:bootshaus-test');
  });
});
