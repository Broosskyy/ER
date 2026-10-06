import type { TicketEvidenceProvider, TicketProviderRegistry } from './types';
import { FourvenuesEvidenceProvider } from './fourvenues-evidence-provider';
import { OrganizerShopEvidenceProvider } from './organizer-shop-evidence-provider';
import { PaylogicEvidenceProvider } from './paylogic-evidence-provider';
import { TicketIoEvidenceProvider } from './ticket-io-evidence-provider';
import { TicketKingsEvidenceProvider } from './ticket-kings-evidence-provider';
import {
  isFourvenuesHost,
  isPaylogicHost,
  isTicketIoHost,
  isTicketKingsHost,
} from './url-policy';

const SPECIFIC_PROVIDERS: TicketEvidenceProvider[] = [
  new TicketIoEvidenceProvider(),
  new PaylogicEvidenceProvider(),
  new FourvenuesEvidenceProvider(),
  new TicketKingsEvidenceProvider(),
];

const ORGANIZER_SHOP_PROVIDER = new OrganizerShopEvidenceProvider();

export class DefaultTicketProviderRegistry implements TicketProviderRegistry {
  private readonly providers: TicketEvidenceProvider[];

  constructor(providers: TicketEvidenceProvider[] = SPECIFIC_PROVIDERS) {
    this.providers = providers;
  }

  resolveProvider(url: URL): TicketEvidenceProvider | null {
    for (const provider of this.providers) {
      if (provider.canHandle(url)) {
        return provider;
      }
    }
    if (url.protocol === 'https:') {
      return ORGANIZER_SHOP_PROVIDER;
    }
    return null;
  }
}

export function classifyProviderKeyFromUrl(url: URL): string {
  if (isTicketIoHost(url.hostname)) {
    return 'ticket_io';
  }
  if (isTicketKingsHost(url.hostname)) {
    return 'ticket_kings';
  }
  if (isPaylogicHost(url.hostname)) {
    return 'paylogic';
  }
  if (isFourvenuesHost(url.hostname)) {
    return 'fourvenues';
  }
  return 'organizer_shop';
}

export const defaultTicketProviderRegistry = new DefaultTicketProviderRegistry();
