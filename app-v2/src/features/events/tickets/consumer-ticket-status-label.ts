const CONSUMER_TICKET_STATUS_LABELS: Record<string, string> = {
  available: 'Tickets verfügbar',
  on_sale: 'Tickets verfügbar',
  sold_out: 'Ausverkauft',
  sales_ended: 'Verkauf beendet',
  sale_not_started: 'Verkauf startet bald',
  cancelled: 'Abgesagt',
  availability_unverified: 'Ticketverfügbarkeit wird geprüft',
  provider_access_unavailable: 'Ticketverfügbarkeit wird geprüft',
  presale_registration: 'Vorverkauf',
};

const RAW_TICKET_STATUS_VALUES = new Set([
  'available',
  'on_sale',
  'sold_out',
  'sales_ended',
  'sale_not_started',
  'cancelled',
  'availability_unverified',
  'provider_access_unavailable',
  'presale_registration',
]);

export function projectConsumerTicketStatusLabel(salesStatus: string | null | undefined): string | undefined {
  if (!salesStatus) {
    return undefined;
  }
  if (salesStatus === 'available' || salesStatus === 'on_sale') {
    return undefined;
  }
  return CONSUMER_TICKET_STATUS_LABELS[salesStatus] ?? undefined;
}

export function isRawTicketStatusValue(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return RAW_TICKET_STATUS_VALUES.has(value.trim());
}

export function containsTechnicalProviderState(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return /\bprovider_access_unavailable\b/i.test(value);
}
