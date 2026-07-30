import type { TicketPlatformId } from '../types';
import { parseTicketIoShopHtml } from './adapters/ticket-io-adapter';

export interface TicketPlatformAdapter {
  readonly platformId: TicketPlatformId;
  parseShopHtml(html: string, config: import('../types').TicketPlatformSourceConfig): ReturnType<typeof parseTicketIoShopHtml>;
}

const ticketIoAdapter: TicketPlatformAdapter = {
  platformId: 'ticket_io',
  parseShopHtml: parseTicketIoShopHtml,
};

const adapters = new Map<TicketPlatformId, TicketPlatformAdapter>([
  ['ticket_io', ticketIoAdapter],
]);

export function getTicketPlatformAdapter(platform: TicketPlatformId): TicketPlatformAdapter {
  const adapter = adapters.get(platform);
  if (!adapter) {
    throw new Error(`Ticket platform adapter "${platform}" is not registered.`);
  }
  return adapter;
}

export function listTicketPlatformAdapters(): TicketPlatformAdapter[] {
  return [...adapters.values()];
}
