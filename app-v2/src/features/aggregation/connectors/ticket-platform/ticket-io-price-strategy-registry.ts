export type TicketIoPriceStrategy =
  | 'json_ld_list_offer'
  | 'list_overview_row'
  | 'list_card_html'
  | 'list_embedded_json'
  | 'json_ld_detail_offers'
  | 'detail_embedded_json'
  | 'public_event_endpoint'
  | 'public_checkout_endpoint'
  | 'stored_historical_evidence'
  | 'detail_blocked_list_only'
  | 'externally_blocked'
  | 'unassigned';

export interface TicketIoShopPriceProfile {
  shopSlug: string;
  strategy: TicketIoPriceStrategy;
  listPageAccessible: boolean;
  detailPageAccessible: boolean;
  notes?: string;
}

const DEFAULT_STRATEGY: TicketIoPriceStrategy = 'json_ld_list_offer';

const SHOP_PROFILES: Record<string, Partial<TicketIoShopPriceProfile>> = {
  'bootshaus-club': {
    strategy: 'list_card_html',
    listPageAccessible: true,
    detailPageAccessible: false,
    notes: 'Modern row cards + tio-overview-tickets-from; detail ALTCHA-blocked',
  },
  'bootshaus-tickets': {
    strategy: 'list_card_html',
    listPageAccessible: true,
    detailPageAccessible: false,
    notes: 'Checkout-style ticket-option-choice layout; legacy event-row parser misses prices',
  },
  'blacklist-festival': {
    strategy: 'list_overview_row',
    listPageAccessible: true,
    detailPageAccessible: false,
  },
  lehmannclub: { strategy: 'json_ld_list_offer', listPageAccessible: true, detailPageAccessible: false },
  protontheclub: { strategy: 'json_ld_list_offer', listPageAccessible: true, detailPageAccessible: false },
  technodampfer: { strategy: 'list_overview_row', listPageAccessible: true, detailPageAccessible: false },
  area51events: { strategy: 'json_ld_list_offer', listPageAccessible: true, detailPageAccessible: false },
  'hmg-concerts': { strategy: 'list_overview_row', listPageAccessible: true, detailPageAccessible: false },
  'unreal-bootshaus': { strategy: 'list_overview_row', listPageAccessible: true, detailPageAccessible: false },
  polyamor: { strategy: 'list_overview_row', listPageAccessible: true, detailPageAccessible: false },
};

export function resolveTicketIoPriceStrategy(shopSlug: string): TicketIoShopPriceProfile {
  const normalized = shopSlug.trim().toLowerCase();
  const profile = SHOP_PROFILES[normalized];
  return {
    shopSlug: normalized,
    strategy: profile?.strategy ?? DEFAULT_STRATEGY,
    listPageAccessible: profile?.listPageAccessible ?? true,
    detailPageAccessible: profile?.detailPageAccessible ?? false,
    notes: profile?.notes,
  };
}

export function listRegisteredTicketIoShopProfiles(): TicketIoShopPriceProfile[] {
  return Object.keys(SHOP_PROFILES).map((slug) => resolveTicketIoPriceStrategy(slug));
}
