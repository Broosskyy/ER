import type { TicketPlatformId } from './types';
import { parseTicketIoShopHtml } from './adapters/ticket-io-adapter';
import { parseTicketKingsShopHtml } from './adapters/ticket-kings-adapter';
import type { TicketPlatformScopeStats, TicketPlatformSourceConfig } from './types';
import type { ParsedTicketPlatformEvent } from './types';

export interface TicketPlatformParseResult {
  events: ParsedTicketPlatformEvent[];
  scopeStats: TicketPlatformScopeStats;
}

export interface TicketPlatformAdapter {
  readonly platformId: TicketPlatformId;
  parseShopHtml(html: string, config: TicketPlatformSourceConfig): TicketPlatformParseResult;
}

const ticketIoAdapter: TicketPlatformAdapter = {
  platformId: 'ticket_io',
  parseShopHtml: parseTicketIoShopHtml,
};

const ticketKingAdapter: TicketPlatformAdapter = {
  platformId: 'ticket_king',
  parseShopHtml: parseTicketKingsShopHtml,
};

const adapters = new Map<TicketPlatformId, TicketPlatformAdapter>([
  ['ticket_io', ticketIoAdapter],
  ['ticket_king', ticketKingAdapter],
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
