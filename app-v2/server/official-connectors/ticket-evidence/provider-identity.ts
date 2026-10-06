export function normalizeTicketIoShopHost(hostname: string): string {
  return hostname.trim().toLowerCase();
}

export function buildTicketIoProviderIdentityKey(shopHost: string, providerEventId: string): string {
  return `ticket_io:${normalizeTicketIoShopHost(shopHost)}:${providerEventId}`;
}
