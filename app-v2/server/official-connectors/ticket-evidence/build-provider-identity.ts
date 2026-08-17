import type { TicketProviderIdentity } from './types';
import {
  buildTicketIoProviderIdentityKey,
  normalizeTicketIoShopHost,
} from './provider-identity';

export function buildTicketIoIdentity(hostname: string, providerEventId: string): TicketProviderIdentity {
  const shopHost = normalizeTicketIoShopHost(hostname);
  return {
    providerKey: 'ticket_io',
    providerEventId,
    providerScope: shopHost,
    identityKey: buildTicketIoProviderIdentityKey(shopHost, providerEventId),
  };
}

export function buildPaylogicIdentity(providerEventId: string): TicketProviderIdentity {
  return {
    providerKey: 'paylogic',
    providerEventId,
    providerScope: 'shop.paylogic.com',
    identityKey: `paylogic:shop.paylogic.com:${providerEventId}`,
  };
}

export function buildFourvenuesIdentity(providerEventId: string, scope = 'site.fourvenues.com'): TicketProviderIdentity {
  return {
    providerKey: 'fourvenues',
    providerEventId,
    providerScope: scope,
    identityKey: `fourvenues:${scope}:${providerEventId}`,
  };
}

export function buildOrganizerShopIdentity(hostname: string, providerEventId: string): TicketProviderIdentity {
  const scope = hostname.trim().toLowerCase();
  return {
    providerKey: 'organizer_shop',
    providerEventId,
    providerScope: scope,
    identityKey: `organizer_shop:${scope}:${providerEventId}`,
  };
}

export function buildTicketKingsIdentity(hostname: string, providerEventId: string): TicketProviderIdentity {
  const scope = hostname.trim().toLowerCase();
  return {
    providerKey: 'ticket_kings',
    providerEventId,
    providerScope: scope,
    identityKey: `ticket_kings:${scope}:${providerEventId}`,
  };
}

export function buildUnsupportedIdentity(hostname: string, pathHash: string): TicketProviderIdentity {
  const scope = hostname.trim().toLowerCase();
  return {
    providerKey: 'unsupported',
    providerEventId: pathHash,
    providerScope: scope,
    identityKey: `unsupported:${scope}:${pathHash}`,
  };
}
